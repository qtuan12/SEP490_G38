const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5160/api';

export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

const ACCESS_TOKEN_KEY = 'bpg_token';
const REFRESH_TOKEN_KEY = 'bpg_refresh_token';
const USER_KEY = 'bpg_user';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

function clearSessionAndRedirect() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
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
    return newAccessToken;
  } catch {
    return null;
  }
}

export const apiClient = {
  async request<T>(endpoint: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);

    // Setup headers
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
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
    };

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
        // Ưu tiên "errors" (thông điệp validate chi tiết) trước "message" (thường chỉ là
        // câu chung chung kiểu "Dữ liệu đầu vào không hợp lệ." đi kèm errorCode VAL_001)
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
          if (response.status === 500) {
            errMsg = 'Lỗi hệ thống hoặc mất kết nối cơ sở dữ liệu (Database). Vui lòng liên hệ quản trị viên.';
          } else if (response.status === 502 || response.status === 503 || response.status === 504) {
            errMsg = 'Máy chủ dịch vụ đang bảo trì hoặc không phản hồi. Vui lòng thử lại sau.';
          } else {
            errMsg = `Lỗi hệ thống (Mã lỗi: ${response.status})`;
          }
        }
        throw new Error(errMsg);
      }

      // If response is empty (e.g. 204 No Content)
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json() as T;
    } catch (error: any) {
      console.error('API Request Error:', error.message);
      
      const msg = error.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('fetch') || error.name === 'TypeError') {
        throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.');
      }
      
      throw error;
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
