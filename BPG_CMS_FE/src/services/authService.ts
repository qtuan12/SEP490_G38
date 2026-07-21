import { apiClient, USE_MOCK_API } from './api';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'technicalmanager' | 'projectleader' | 'siteengineer' | 'accountant' | 'director';
  status: 'active' | 'locked';
  avatarUrl?: string | null;
}

export interface UserDetailProfile {
  userId: number;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: UserProfile;
}

export type LoginCredentials = {
  email: string;
  password?: string;
};

// Define predefined mock users matching roles in "Mô tả chi tiết.md"
const MOCK_USERS: Record<string, UserProfile & { password: string }> = {
  'admin@bpg.com': { id: 'u-1', name: 'Hệ thống Admin', email: 'admin@bpg.com', password: 'admin123', role: 'admin', status: 'active' },
  'tpkt@bpg.com': { id: 'u-2', name: 'Nguyễn Văn Kỹ', email: 'tpkt@bpg.com', password: 'tpkt123', role: 'technicalmanager', status: 'active' },
  'engineer@bpg.com': { id: 'u-3', name: 'Trần Văn Công', email: 'engineer@bpg.com', password: 'eng123', role: 'siteengineer', status: 'active' },
  'se1@bpg.com': { id: 'u-6', name: 'Nguyễn Văn Nam', email: 'se1@bpg.com', password: 'se123', role: 'siteengineer', status: 'active' },
  'se2@bpg.com': { id: 'u-7', name: 'Phạm Minh Hải', email: 'se2@bpg.com', password: 'se123', role: 'siteengineer', status: 'active' },
  'se3@bpg.com': { id: 'u-8', name: 'Hoàng Việt Anh', email: 'se3@bpg.com', password: 'se123', role: 'siteengineer', status: 'active' },
  'se4@bpg.com': { id: 'u-9', name: 'Đỗ Thùy Linh', email: 'se4@bpg.com', password: 'se123', role: 'siteengineer', status: 'active' },
  'giamdoc@bpg.com': { id: 'u-4', name: 'Phạm Huy Hoàng', email: 'giamdoc@bpg.com', password: 'gd123', role: 'director', status: 'active' },
  'ketoan@bpg.com': { id: 'u-5', name: 'Lê Thị Thu', email: 'ketoan@bpg.com', password: 'kt123', role: 'accountant', status: 'active' },
};

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    if (USE_MOCK_API) {
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mockUser = MOCK_USERS[credentials.email.toLowerCase()];
      
      // Check for custom password override in localStorage
      const customPasswordsStr = localStorage.getItem('bpg_custom_passwords');
      const customPasswords = customPasswordsStr ? JSON.parse(customPasswordsStr) : {};
      const expectedPassword = customPasswords[credentials.email.toLowerCase()] || mockUser?.password;

      if (!mockUser || expectedPassword !== credentials.password) {
        throw new Error('Email hoặc mật khẩu không chính xác.');
      }

      if (mockUser.status === 'locked') {
        throw new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.');
      }

      // Generate a mock JWT token
      const mockToken = `mock-jwt-token-for-${mockUser.id}`;

      // Save mock users to localStorage for CRUD sync
      const currentListStr = localStorage.getItem('bpg_users_list');
      const usersList = Object.values(MOCK_USERS).map(({ password, ...user }) => user);
      if (!currentListStr) {
        localStorage.setItem('bpg_users_list', JSON.stringify(usersList));
      } else {
        const currentUsers: UserProfile[] = JSON.parse(currentListStr);
        let updated = false;
        usersList.forEach(d => {
          if (!currentUsers.some(u => u.id === d.id)) {
            currentUsers.push(d);
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem('bpg_users_list', JSON.stringify(currentUsers));
        }
      }

      return {
        token: mockToken,
        refreshToken: `mock-refresh-token-for-${mockUser.id}`,
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
    interface BackendLoginResponse {
      success: boolean;
      message: string;
      data: {
        userId: string;
        fullName: string;
        email: string;
        role: string;
        accessToken: string;
        refreshToken: string;
      };
    }

    const response = await apiClient.post<BackendLoginResponse>('/auth/login', credentials);

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Đăng nhập thất bại.');
    }

    const { data } = response;
    return {
      token: data.accessToken,
      refreshToken: data.refreshToken,
      user: {
        id: String(data.userId),
        name: data.fullName,
        email: data.email,
        role: data.role.toLowerCase() as UserProfile['role'],
        status: 'active'
      }
    };
  },

  async updateProfile(fullName: string, phoneNumber: string | null, avatarUrl?: string | null): Promise<UserDetailProfile> {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 400));
      const storedUser = localStorage.getItem('bpg_user');
      if (!storedUser) throw new Error('Chưa đăng nhập.');
      const u: UserProfile = JSON.parse(storedUser);
      const updated = { ...u, name: fullName };
      localStorage.setItem('bpg_user', JSON.stringify(updated));
      return { userId: Number(u.id), fullName, email: u.email, phoneNumber, avatarUrl: avatarUrl ?? null, role: u.role, isActive: u.status === 'active', lastLoginAt: null, passwordChangedAt: null };
    }

    interface BackendResponse { success: boolean; message: string; data: UserDetailProfile; }
    const response = await apiClient.patch<BackendResponse>('/auth/me', { fullName, phoneNumber, avatarUrl });
    if (!response.success || !response.data) throw new Error(response.message || 'Cập nhật thất bại.');
    return response.data;
  },

  async uploadAvatar(file: File): Promise<string> {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 600));
      return URL.createObjectURL(file);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'users/avatars');

    interface BackendResponse { success: boolean; message: string; data: { fileUrl: string }; }
    const response = await apiClient.postFormData<BackendResponse>('/files/upload', formData);
    if (!response.success || !response.data) throw new Error(response.message || 'Tải ảnh lên thất bại.');
    return response.data.fileUrl;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 400));
      const storedUser = localStorage.getItem('bpg_user');
      if (!storedUser) throw new Error('Chưa đăng nhập.');
      const u = JSON.parse(storedUser);
      const customPasswords = JSON.parse(localStorage.getItem('bpg_custom_passwords') || '{}');
      const current = customPasswords[u.email] ?? '123456';
      if (currentPassword !== current) throw new Error('Mật khẩu hiện tại không chính xác.');
      if (newPassword.length < 6) throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
      customPasswords[u.email] = newPassword;
      localStorage.setItem('bpg_custom_passwords', JSON.stringify(customPasswords));
      return;
    }

    interface BackendResponse { success: boolean; message: string; }
    const response = await apiClient.post<BackendResponse>('/auth/change-password', { currentPassword, newPassword });
    if (!response.success) throw new Error(response.message || 'Đổi mật khẩu thất bại.');
  },

  async getMe(): Promise<UserDetailProfile> {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 300));
      const storedUser = localStorage.getItem('bpg_user');
      if (!storedUser) throw new Error('Chưa đăng nhập.');
      const u: UserProfile = JSON.parse(storedUser);
      return { userId: Number(u.id), fullName: u.name, email: u.email, phoneNumber: null, avatarUrl: null, role: u.role, isActive: u.status === 'active', lastLoginAt: null, passwordChangedAt: null };
    }

    interface BackendResponse {
      success: boolean;
      message: string;
      data: UserDetailProfile;
    }
    const response = await apiClient.get<BackendResponse>('/auth/me');
    if (!response.success || !response.data) throw new Error(response.message || 'Không thể tải thông tin.');
    return response.data;
  },

  async forgotPassword(email: string): Promise<void> {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 600));
      return;
    }
    interface BackendResponse { success: boolean; message: string; }
    const response = await apiClient.post<BackendResponse>('/auth/forgot-password', { email });
    if (!response.success) throw new Error(response.message || 'Gửi OTP thất bại.');
  },

  async verifyOtp(email: string, otp: string): Promise<string> {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 600));
      if (otp !== '123456') throw new Error('Mã OTP không đúng. Còn 4 lần thử.');
      return 'mock-reset-token-' + Date.now();
    }
    interface BackendResponse { success: boolean; message: string; data: { resetToken: string }; }
    const response = await apiClient.post<BackendResponse>('/auth/verify-otp', { email, otp });
    if (!response.success || !response.data) throw new Error(response.message || 'Xác thực OTP thất bại.');
    return response.data.resetToken;
  },

  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 600));
      return;
    }
    interface BackendResponse { success: boolean; message: string; }
    const response = await apiClient.post<BackendResponse>('/auth/reset-password', { resetToken, newPassword });
    if (!response.success) throw new Error(response.message || 'Đặt lại mật khẩu thất bại.');
  },

  logout(): void {
    if (!USE_MOCK_API) {
      const refreshToken = localStorage.getItem('bpg_refresh_token');
      apiClient.post('/auth/logout', { refreshToken }).catch(() => {});
    }
  }
};
