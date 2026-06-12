const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5160/api';

export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

interface ApiClient {
  request<T>(endpoint: string, options?: RequestOptions): Promise<T>;
  get<T>(endpoint: string, options?: Omit<RequestOptions, 'method'>): Promise<T>;
  post<T>(endpoint: string, body: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  put<T>(endpoint: string, body: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method'>): Promise<T>;
}

export const apiClient: ApiClient = {
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const token = localStorage.getItem('bpg_token');

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
      const searchParams = new URLSearchParams(options.params);
      url += `?${searchParams.toString()}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // Clear auth and redirect
        localStorage.removeItem('bpg_token');
        localStorage.removeItem('bpg_user');
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || (errorData.errors && errorData.errors.join(', ')) || `HTTP error! Status: ${response.status}`;
        throw new Error(message);
      }

      // If response is empty (e.g. 204 No Content)
      if (response.status === 204) {
        return {} as T;
      }

      const json = await response.json();

      // Check if response matches the standardized ApiResponse format
      if (json && typeof json === 'object' && 'success' in json) {
        if (!json.success) {
          const message = json.message || (json.errors && json.errors.join(', ')) || 'API request failed';
          throw new Error(message);
        }
        return json.data as T;
      }

      return json as T;
    } catch (error: any) {
      console.error('API Request Error:', error.message);
      throw error;
    }
  },

  get<T>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return apiClient.request<T>(endpoint, { ...options, method: 'GET' });
  },

  post<T>(endpoint: string, body: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return apiClient.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  put<T>(endpoint: string, body: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return apiClient.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  delete<T>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return apiClient.request<T>(endpoint, { ...options, method: 'DELETE' });
  },
};
