import { apiClient, USE_MOCK_API } from './api';
import type { UserProfile } from './authService';

const getLocalUsers = (): UserProfile[] => {
  const usersStr = localStorage.getItem('bpg_users_list');
  const defaults: UserProfile[] = [
    { id: 'u-1', name: 'Hệ thống Admin', email: 'admin@bpg.com', role: 'admin', status: 'active' },
    { id: 'u-2', name: 'Nguyễn Văn Kỹ', email: 'tpkt@bpg.com', role: 'technicalmanager', status: 'active' },
    { id: 'u-3', name: 'Trần Văn Công', email: 'engineer@bpg.com', role: 'siteengineer', status: 'active' },
    { id: 'u-6', name: 'Nguyễn Văn Nam', email: 'se1@bpg.com', role: 'siteengineer', status: 'active' },
    { id: 'u-7', name: 'Phạm Minh Hải', email: 'se2@bpg.com', role: 'siteengineer', status: 'active' },
    { id: 'u-8', name: 'Hoàng Việt Anh', email: 'se3@bpg.com', role: 'siteengineer', status: 'active' },
    { id: 'u-9', name: 'Đỗ Thùy Linh', email: 'se4@bpg.com', role: 'siteengineer', status: 'active' },
    { id: 'u-4', name: 'Phạm Huy Hoàng', email: 'giamdoc@bpg.com', role: 'director', status: 'active' },
    { id: 'u-5', name: 'Lê Thị Thu', email: 'ketoan@bpg.com', role: 'accountant', status: 'active' },
  ];

  if (!usersStr) {
    localStorage.setItem('bpg_users_list', JSON.stringify(defaults));
    return defaults;
  }

  const currentUsers: UserProfile[] = JSON.parse(usersStr);
  let updated = false;
  defaults.forEach(d => {
    if (!currentUsers.some(u => u.id === d.id)) {
      currentUsers.push(d);
      updated = true;
    }
  });

  if (updated) {
    localStorage.setItem('bpg_users_list', JSON.stringify(currentUsers));
  }

  return currentUsers;
};

const saveLocalUsers = (users: UserProfile[]) => {
  localStorage.setItem('bpg_users_list', JSON.stringify(users));
};

type ApiResponse<T> = { success: boolean; message?: string; data: T };

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Yêu cầu thất bại.');
  return res.data;
};

export interface PaginatedUsers {
  items: UserProfile[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface GetUsersParams {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  role?: string;
}

export const userService = {
  async getUsers(params: GetUsersParams = {}): Promise<PaginatedUsers> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 300));
      let users = getLocalUsers();
      if (params.search) {
        const kw = params.search.toLowerCase();
        users = users.filter(u => u.name.toLowerCase().includes(kw) || u.email.toLowerCase().includes(kw));
      }
      if (params.role) users = users.filter(u => u.role === params.role);
      const pageNumber = params.pageNumber ?? 1;
      const pageSize = params.pageSize ?? 20;
      const totalCount = users.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const items = users.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
      return { items, totalCount, pageNumber, pageSize, totalPages, hasPreviousPage: pageNumber > 1, hasNextPage: pageNumber < totalPages };
    }
    const queryParams: Record<string, string> = {
      pageNumber: String(params.pageNumber ?? 1),
      pageSize: String(params.pageSize ?? 20),
    };
    if (params.search) queryParams.search = params.search;
    if (params.role) queryParams.role = params.role;
    return unwrap(await apiClient.get<ApiResponse<PaginatedUsers>>('/users', { params: queryParams }));
  },

  async createUser(userData: Omit<UserProfile, 'id' | 'status'>): Promise<UserProfile> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const users = getLocalUsers();
      if (users.some(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
        throw new Error('Email đã tồn tại trong hệ thống.');
      }
      const newUser: UserProfile = { ...userData, id: `u-${Date.now()}`, status: 'active' };
      users.push(newUser);
      saveLocalUsers(users);
      return newUser;
    }
    return unwrap(await apiClient.post<ApiResponse<UserProfile>>('/users', userData));
  },

  async updateUser(id: string, userData: Partial<UserProfile>): Promise<UserProfile> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const users = getLocalUsers();
      const userIndex = users.findIndex(u => u.id === id);
      if (userIndex === -1) throw new Error('Không tìm thấy người dùng.');
      if (userData.email && userData.email.toLowerCase() !== users[userIndex].email.toLowerCase()) {
        if (users.some(u => u.email.toLowerCase() === userData.email!.toLowerCase())) {
          throw new Error('Email đã được sử dụng bởi tài khoản khác.');
        }
      }
      const updatedUser = { ...users[userIndex], ...userData };
      users[userIndex] = updatedUser;
      saveLocalUsers(users);
      return updatedUser;
    }
    return unwrap(await apiClient.put<ApiResponse<UserProfile>>(`/users/${id}`, userData));
  },

  async deleteUser(id: string): Promise<void> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const users = getLocalUsers();
      saveLocalUsers(users.filter(u => u.id !== id));
      return;
    }
    await apiClient.delete<ApiResponse<null>>(`/users/${id}`);
  },

  async toggleUserStatus(id: string): Promise<UserProfile> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const users = getLocalUsers();
      const userIndex = users.findIndex(u => u.id === id);
      if (userIndex === -1) throw new Error('Không tìm thấy người dùng.');
      const updatedUser: UserProfile = { ...users[userIndex], status: users[userIndex].status === 'active' ? 'locked' : 'active' };
      users[userIndex] = updatedUser;
      saveLocalUsers(users);
      return updatedUser;
    }
    return unwrap(await apiClient.post<ApiResponse<UserProfile>>(`/users/${id}/toggle-status`, {}));
  }
};
