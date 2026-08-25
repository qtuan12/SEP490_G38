import { triggerGlobalLoading, triggerGlobalHideLoading } from '../context/LoadingContext';
import { queryClient } from '../lib/queryClient';
import { compressFormDataImages } from '../utils/fileCompression';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://localhost:7111/api';

export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

const ACCESS_TOKEN_KEY = 'bpg_token';
const REFRESH_TOKEN_KEY = 'bpg_refresh_token';
const USER_KEY = 'bpg_user';

/**
 * localStorage's `storage` event is only emitted in other tabs. Dispatch a
 * same-tab event as well so React state and long-lived connections immediately
 * pick up an access token refreshed by the API client.
 */
export const ACCESS_TOKEN_CHANGED_EVENT = 'bpg:access-token-changed';

const notifyAccessTokenChanged = (accessToken: string) => {
  window.dispatchEvent(new CustomEvent(ACCESS_TOKEN_CHANGED_EVENT, {
    detail: { accessToken },
  }));
};

let activeApiRequestsCount = 0;

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  showGlobalLoading?: boolean;
}

/**
 * Lỗi trả về từ backend, giữ nguyên errorCode để caller map lỗi vào đúng trường
 * thay vì phải so khớp nội dung message (message có thể đổi bất cứ lúc nào).
 * Vẫn kế thừa Error nên mọi chỗ đang dùng `err.message` không cần sửa.
 */
export class ApiError extends Error {
  readonly errorCode?: string;
  readonly errors?: string[];
  /** Lỗi validate theo từng trường (key = tên property của command, camelCase) — dùng để gắn dòng đỏ dưới ô nhập. */
  readonly fieldErrors?: Record<string, string[]>;
  readonly status: number;

  constructor(
    message: string,
    status: number,
    errorCode?: string,
    errors?: string[],
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.errors = errors;
    this.fieldErrors = fieldErrors;
  }
}

function clearSessionAndRedirect() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  queryClient.clear();
  window.location.href = '/login';
}

// Gom các lần 401 xảy ra đồng thời lại thành 1 lần gọi /auth/refresh-token duy nhất.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;

    const json = await res.json();
    const newAccessToken = json?.data?.accessToken;
    const newRefreshToken = json?.data?.refreshToken;
    if (!newAccessToken || !newRefreshToken) return null;

    localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
    notifyAccessTokenChanged(newAccessToken);
    return newAccessToken;
  } catch {
    return null;
  }
}

export const apiClient = {
  async request<T>(endpoint: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const requestBody = options.body instanceof FormData
      ? await compressFormDataImages(options.body)
      : options.body;

    // Setup headers
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && !(requestBody instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // Build URL with query params
    let url = `${BASE_URL}${endpoint}`;
    if (options.params) {
      const cleanParams = Object.entries(options.params)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {} as Record<string, string>);
      const searchParams = new URLSearchParams(cleanParams);
      const queryStr = searchParams.toString();
      if (queryStr) {
        url += `?${queryStr}`;
      }
    }

    const config: RequestInit = {
      ...options,
      headers,
      body: requestBody,
    };

    const shouldShowGlobal = options.showGlobalLoading === true;

    if (shouldShowGlobal) {
      activeApiRequestsCount++;
      triggerGlobalLoading('Hệ thống đang xử lý dữ liệu...');
    }

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // Nếu đang gọi login thì không redirect — chỉ throw message từ backend
        if (endpoint === '/auth/login') {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Email hoặc mật khẩu không chính xác.');
        }

        // Access token hết hạn → thử refresh 1 lần rồi retry lại request gốc.
        // Không refresh nếu chính request này đã là retry, hoặc đang gọi refresh-token/logout.
        const skipRefresh = isRetry || endpoint === '/auth/refresh-token' || endpoint === '/auth/logout';
        if (!skipRefresh) {
          if (!refreshPromise) {
            refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
          }
          const newToken = await refreshPromise;
          if (newToken) {
            return apiClient.request<T>(endpoint, options, true);
          }
        }

        // Refresh thất bại hoặc không áp dụng được → session hết hạn thật sự
        clearSessionAndRedirect();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errMsg = '';
        if (errorData.errors) {
          if (Array.isArray(errorData.errors) && errorData.errors.length > 0) {
            errMsg = errorData.errors.join(' ');
          } else if (typeof errorData.errors === 'object' && errorData.errors !== null) {
            errMsg = Object.values(errorData.errors)
              .flatMap((messages: any) => messages)
              .join(' ');
          }
        }
        if (!errMsg && errorData.message) {
          errMsg = errorData.message;
        } else if (!errMsg && errorData.title) {
          errMsg = errorData.title;
        }

        if (!errMsg) {
          if (response.status === 403) {
            errMsg = 'Bạn không có quyền thực hiện thao tác này.';
          } else if (response.status === 401) {
            errMsg = 'Phiên đăng nhập đã hết hạn hoặc chưa xác thực. Vui lòng đăng nhập lại.';
          } else if (response.status === 404) {
            errMsg = 'Tài nguyên hoặc dữ liệu yêu cầu không tồn tại.';
          } else if (response.status === 413) {
            errMsg = 'Kích thước file tải lên quá lớn. Vui lòng chọn file có dung lượng nhỏ hơn.';
          } else if (response.status === 429) {
            errMsg = 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.';
          } else if (response.status === 500) {
            errMsg = 'Không thể kết nối đến cơ sở dữ liệu. Vui lòng liên hệ quản trị viên.';
          } else if (response.status === 502 || response.status === 503 || response.status === 504) {
            errMsg = 'Máy chủ dịch vụ đang bảo trì hoặc không phản hồi. Vui lòng thử lại sau.';
          } else {
            errMsg = `Không thể xử lý yêu cầu (mã lỗi: ${response.status}).`;
          }
        }
        throw new ApiError(
          errMsg,
          response.status,
          errorData.errorCode,
          Array.isArray(errorData.errors) ? errorData.errors : undefined,
          errorData.fieldErrors && typeof errorData.fieldErrors === 'object'
            ? errorData.fieldErrors
            : undefined,
        );
      }

      // If response is empty (e.g. 204 No Content)
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json() as T;
    } catch (error: any) {
      console.error('API Request Error:', error.message);
      
      // ApiError là lỗi nghiệp vụ đã có message từ backend — giữ nguyên, không nhầm thành lỗi mạng.
      const msg = error instanceof ApiError ? '' : (error.message || '');
      if (msg.includes('Failed to fetch') || msg.includes('fetch') || error.name === 'TypeError') {
        throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.');
      }
      
      throw error;
    } finally {
      if (shouldShowGlobal) {
        activeApiRequestsCount = Math.max(0, activeApiRequestsCount - 1);
        if (activeApiRequestsCount === 0) {
          triggerGlobalHideLoading();
        }
      }
    }
  },

  get<T>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return apiClient.request<T>(endpoint, { ...options, method: 'GET' });
  },

  post<T>(endpoint: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return apiClient.request<T>(endpoint, {
      ...options,
      method: 'POST',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
  },

  postFormData<T>(endpoint: string, formData: FormData, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return apiClient.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: formData,
    });
  },

  putFormData<T>(endpoint: string, formData: FormData, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return apiClient.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: formData,
    });
  },

  put<T>(endpoint: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return apiClient.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
  },

  patch<T>(endpoint: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return apiClient.request<T>(endpoint, { ...options, method: 'PATCH', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  },

  delete<T>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return apiClient.request<T>(endpoint, { ...options, method: 'DELETE' });
  },
};
