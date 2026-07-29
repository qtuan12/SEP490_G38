import { apiClient, USE_MOCK_API } from './api';
import type { UserRole } from '../auth/roles';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roles?: UserRole[];
  status: 'active' | 'locked';
  avatarUrl?: string | null;
  phoneNumber?: string | null;
}

export interface UserDetailProfile {
  userId: number;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  role: string;
  roles: string[];
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

const VALID_ROLES: readonly UserRole[] = [
  'admin',
  'technicalmanager',
  'siteengineer',
  'accountant',
  'director',
];

const normalizeRole = (role: string): UserRole => {
  const normalized = role.toLowerCase() as UserRole;
  if (!VALID_ROLES.includes(normalized)) {
    throw new Error(`Vai trÃ² tÃ i khoáº£n khÃ´ng Ä‘Æ°á»£c há»— trá»£: ${role || '(trá»‘ng)'}.`);
  }
  return normalized;
};

const toUserProfile = (profile: UserDetailProfile): UserProfile => {
  const roles = (profile.roles?.length ? profile.roles : [profile.role]).map(normalizeRole);
  return {
    id: String(profile.userId),
    name: profile.fullName,
    email: profile.email,
    phoneNumber: profile.phoneNumber,
    avatarUrl: profile.avatarUrl,
    role: normalizeRole(profile.role || roles[0]),
    roles,
    status: profile.isActive ? 'active' : 'locked',
  };
};

// Define predefined mock users matching roles in "MÃ´ táº£ chi tiáº¿t.md"
const MOCK_USERS: Record<string, UserProfile & { password: string }> = {
  'admin@bpg.com': { id: 'u-1', name: 'Há»‡ thá»‘ng Admin', email: 'admin@bpg.com', password: 'admin123', role: 'admin', status: 'active' },
  'tpkt@bpg.com': { id: 'u-2', name: 'Nguyá»…n VÄƒn Ká»¹', email: 'tpkt@bpg.com', password: 'tpkt123', role: 'technicalmanager', status: 'active' },
  'engineer@bpg.com': { id: 'u-3', name: 'Tráº§n VÄƒn CÃ´ng', email: 'engineer@bpg.com', password: 'eng123', role: 'siteengineer', status: 'active' },
  'se1@bpg.com': { id: 'u-6', name: 'Nguyá»…n VÄƒn Nam', email: 'se1@bpg.com', password: 'se123', role: 'siteengineer', status: 'active' },
  'se2@bpg.com': { id: 'u-7', name: 'Pháº¡m Minh Háº£i', email: 'se2@bpg.com', password: 'se123', role: 'siteengineer', status: 'active' },
  'se3@bpg.com': { id: 'u-8', name: 'HoÃ ng Viá»‡t Anh', email: 'se3@bpg.com', password: 'se123', role: 'siteengineer', status: 'active' },
  'se4@bpg.com': { id: 'u-9', name: 'Äá»— ThÃ¹y Linh', email: 'se4@bpg.com', password: 'se123', role: 'siteengineer', status: 'active' },
  'giamdoc@bpg.com': { id: 'u-4', name: 'Pháº¡m Huy HoÃ ng', email: 'giamdoc@bpg.com', password: 'gd123', role: 'director', status: 'active' },
  'ketoan@bpg.com': { id: 'u-5', name: 'LÃª Thá»‹ Thu', email: 'ketoan@bpg.com', password: 'kt123', role: 'accountant', status: 'active' },
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
        throw new Error('Email hoáº·c máº­t kháº©u khÃ´ng chÃ­nh xÃ¡c.');
      }

      if (mockUser.status === 'locked') {
        throw new Error('TÃ i khoáº£n cá»§a báº¡n Ä‘Ã£ bá»‹ khÃ³a. Vui lÃ²ng liÃªn há»‡ Admin.');
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
          roles: [mockUser.role],
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
        roles?: string[];
        accessToken: string;
        refreshToken: string;
      };
    }

    const response = await apiClient.post<BackendLoginResponse>('/auth/login', credentials);

    if (!response.success || !response.data) {
      throw new Error(response.message || 'ÄÄƒng nháº­p tháº¥t báº¡i.');
    }

    const { data } = response;
    const roles = (data.roles?.length ? data.roles : [data.role]).map(normalizeRole);
    return {
      token: data.accessToken,
      refreshToken: data.refreshToken,
      user: {
        id: String(data.userId),
        name: data.fullName,
        email: data.email,
        role: normalizeRole(data.role || roles[0]),
        roles,
        status: 'active'
      }
    };
  },

  async updateProfile(fullName: string, phoneNumber: string | null, avatarUrl?: string | null): Promise<UserDetailProfile> {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 400));
      const storedUser = localStorage.getItem('bpg_user');
      if (!storedUser) throw new Error('ChÆ°a Ä‘Äƒng nháº­p.');
      const u: UserProfile = JSON.parse(storedUser);
      const updated = { ...u, name: fullName };
      localStorage.setItem('bpg_user', JSON.stringify(updated));
      const roles = u.roles?.length ? u.roles : [u.role];
      return {
        userId: Number(u.id),
        fullName,
        email: u.email,
        phoneNumber,
        avatarUrl: avatarUrl ?? null,
        role: u.role,
        roles,
        isActive: u.status === 'active',
        lastLoginAt: null,
        passwordChangedAt: null,
      };
    }

    interface BackendResponse { success: boolean; message: string; data: UserDetailProfile; }
    const response = await apiClient.patch<BackendResponse>('/auth/me', { fullName, phoneNumber, avatarUrl });
    if (!response.success || !response.data) throw new Error(response.message || 'Cáº­p nháº­t tháº¥t báº¡i.');
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
    if (!response.success || !response.data) throw new Error(response.message || 'Táº£i áº£nh lÃªn tháº¥t báº¡i.');
    return response.data.fileUrl;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 400));
      const storedUser = localStorage.getItem('bpg_user');
      if (!storedUser) throw new Error('ChÆ°a Ä‘Äƒng nháº­p.');
      const u = JSON.parse(storedUser);
      const customPasswords = JSON.parse(localStorage.getItem('bpg_custom_passwords') || '{}');
      const current = customPasswords[u.email] ?? '123456';
      if (currentPassword !== current) throw new Error('Máº­t kháº©u hiá»‡n táº¡i khÃ´ng chÃ­nh xÃ¡c.');
      if (newPassword.length < 6) throw new Error('Máº­t kháº©u má»›i pháº£i cÃ³ Ã­t nháº¥t 6 kÃ½ tá»±.');
      customPasswords[u.email] = newPassword;
      localStorage.setItem('bpg_custom_passwords', JSON.stringify(customPasswords));
      return;
    }

    interface BackendResponse { success: boolean; message: string; }
    const response = await apiClient.post<BackendResponse>('/auth/change-password', { currentPassword, newPassword });
    if (!response.success) throw new Error(response.message || 'Äá»•i máº­t kháº©u tháº¥t báº¡i.');
  },

  async getMe(): Promise<UserDetailProfile> {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 300));
      const storedUser = localStorage.getItem('bpg_user');
      if (!storedUser) throw new Error('ChÆ°a Ä‘Äƒng nháº­p.');
      const u: UserProfile = JSON.parse(storedUser);
      const roles = u.roles?.length ? u.roles : [u.role];
      return {
        userId: Number(u.id),
        fullName: u.name,
        email: u.email,
        phoneNumber: u.phoneNumber ?? null,
        avatarUrl: u.avatarUrl ?? null,
        role: u.role,
        roles,
        isActive: u.status === 'active',
        lastLoginAt: null,
        passwordChangedAt: null,
      };
    }

    interface BackendResponse {
      success: boolean;
      message: string;
      data: UserDetailProfile;
    }
    const response = await apiClient.get<BackendResponse>('/auth/me');
    if (!response.success || !response.data) throw new Error(response.message || 'KhÃ´ng thá»ƒ táº£i thÃ´ng tin.');
    return response.data;
  },

  async getSessionUser(): Promise<UserProfile> {
    if (USE_MOCK_API) {
      const storedUser = localStorage.getItem('bpg_user');
      if (!storedUser) throw new Error('ChÆ°a Ä‘Äƒng nháº­p.');
      const user = JSON.parse(storedUser) as UserProfile;
      const roles = user.roles?.length ? user.roles : [user.role];
      return {
        ...user,
        roles,
      };
    }

    return toUserProfile(await this.getMe());
  },

  async forgotPassword(email: string): Promise<void> {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 600));
      return;
    }
    interface BackendResponse { success: boolean; message: string; }
    const response = await apiClient.post<BackendResponse>('/auth/forgot-password', { email });
    if (!response.success) throw new Error(response.message || 'Gá»­i OTP tháº¥t báº¡i.');
  },

  async verifyOtp(email: string, otp: string): Promise<string> {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 600));
      if (otp !== '123456') throw new Error('MÃ£ OTP khÃ´ng Ä‘Ãºng. CÃ²n 4 láº§n thá»­.');
      return 'mock-reset-token-' + Date.now();
    }
    interface BackendResponse { success: boolean; message: string; data: { resetToken: string }; }
    const response = await apiClient.post<BackendResponse>('/auth/verify-otp', { email, otp });
    if (!response.success || !response.data) throw new Error(response.message || 'XÃ¡c thá»±c OTP tháº¥t báº¡i.');
    return response.data.resetToken;
  },

  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    if (USE_MOCK_API) {
      await new Promise(r => setTimeout(r, 600));
      return;
    }
    interface BackendResponse { success: boolean; message: string; }
    const response = await apiClient.post<BackendResponse>('/auth/reset-password', { resetToken, newPassword });
    if (!response.success) throw new Error(response.message || 'Äáº·t láº¡i máº­t kháº©u tháº¥t báº¡i.');
  },

  logout(): void {
    if (!USE_MOCK_API) {
      const refreshToken = localStorage.getItem('bpg_refresh_token');
      apiClient.post('/auth/logout', { refreshToken }).catch(() => {});
    }
  }
};

