import { apiClient, USE_MOCK_API } from './api';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'tpkt' | 'kỹ sư' | 'giám đốc' | 'kế toán';
  status: 'active' | 'locked';
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

export type LoginCredentials = {
  email: string;
  password?: string;
};

// Define predefined mock users matching roles in "Mô tả chi tiết.md"
const MOCK_USERS: Record<string, UserProfile & { password: string }> = {
  'admin@bpg.com': { id: 'u-1', name: 'Hệ thống Admin', email: 'admin@bpg.com', password: 'admin123', role: 'admin', status: 'active' },
  'tpkt@bpg.com': { id: 'u-2', name: 'Nguyễn Văn Kỹ', email: 'tpkt@bpg.com', password: 'tpkt123', role: 'tpkt', status: 'active' },
  'engineer@bpg.com': { id: 'u-3', name: 'Trần Văn Công', email: 'engineer@bpg.com', password: 'eng123', role: 'kỹ sư', status: 'active' },
  'giamdoc@bpg.com': { id: 'u-4', name: 'Phạm Huy Hoàng', email: 'giamdoc@bpg.com', password: 'gd123', role: 'giám đốc', status: 'active' },
  'ketoan@bpg.com': { id: 'u-5', name: 'Lê Thị Thu', email: 'ketoan@bpg.com', password: 'kt123', role: 'kế toán', status: 'active' },
};

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    if (USE_MOCK_API) {
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mockUser = MOCK_USERS[credentials.email.toLowerCase()];
      if (!mockUser || mockUser.password !== credentials.password) {
        throw new Error('Email hoặc mật khẩu không chính xác.');
      }

      if (mockUser.status === 'locked') {
        throw new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.');
      }

      // Generate a mock JWT token
      const mockToken = `mock-jwt-token-for-${mockUser.id}`;

      // Save mock users to localStorage for CRUD sync if not present
      if (!localStorage.getItem('bpg_users_list')) {
        const usersList = Object.values(MOCK_USERS).map(({ password, ...user }) => user);
        localStorage.setItem('bpg_users_list', JSON.stringify(usersList));
      }

      return {
        token: mockToken,
        user: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          role: mockUser.role,
          status: mockUser.status
        }
      };
    }

    // Call real backend endpoint
    return apiClient.post<LoginResponse>('/auth/login', credentials);
  },

  logout(): void {
    if (!USE_MOCK_API) {
      // If there's an endpoint to invalidate tokens, call it here
      apiClient.post('/auth/logout', {}).catch(() => {});
    }
  }
};
