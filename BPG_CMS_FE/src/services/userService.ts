import { apiClient, USE_MOCK_API } from './api';
import type { UserProfile } from './authService';

const getLocalUsers = (): UserProfile[] => {
  const usersStr = localStorage.getItem('bpg_users_list');
  const defaults: UserProfile[] = [
    { id: 'u-1', name: 'Hệ thống Admin', email: 'admin@bpg.com', role: 'admin', status: 'active' },
    { id: 'u-2', name: 'Nguyễn Văn Kỹ', email: 'tpkt@bpg.com', role: 'tpkt', status: 'active' },
    { id: 'u-3', name: 'Trần Văn Công', email: 'engineer@bpg.com', role: 'kỹ sư', status: 'active' },
    { id: 'u-6', name: 'Nguyễn Văn Nam', email: 'se1@bpg.com', role: 'kỹ sư', status: 'active' },
    { id: 'u-7', name: 'Phạm Minh Hải', email: 'se2@bpg.com', role: 'kỹ sư', status: 'active' },
    { id: 'u-8', name: 'Hoàng Việt Anh', email: 'se3@bpg.com', role: 'kỹ sư', status: 'active' },
    { id: 'u-9', name: 'Đỗ Thùy Linh', email: 'se4@bpg.com', role: 'kỹ sư', status: 'active' },
    { id: 'u-4', name: 'Phạm Huy Hoàng', email: 'giamdoc@bpg.com', role: 'giám đốc', status: 'active' },
    { id: 'u-5', name: 'Lê Thị Thu', email: 'ketoan@bpg.com', role: 'kế toán', status: 'active' },
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

export const userService = {
  async getUsers(): Promise<UserProfile[]> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return getLocalUsers();
    }
    return apiClient.get<UserProfile[]>('/users');
  },

  async createUser(userData: Omit<UserProfile, 'id' | 'status'>): Promise<UserProfile> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const users = getLocalUsers();
      
      if (users.some(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
        throw new Error('Email đã tồn tại trong hệ thống.');
      }

      const newUser: UserProfile = {
        ...userData,
        id: `u-${Date.now()}`,
        status: 'active',
      };
      
      users.push(newUser);
      saveLocalUsers(users);
      return newUser;
    }
    return apiClient.post<UserProfile>('/users', userData);
  },

  async updateUser(id: string, userData: Partial<UserProfile>): Promise<UserProfile> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const users = getLocalUsers();
      const userIndex = users.findIndex(u => u.id === id);
      
      if (userIndex === -1) {
        throw new Error('Không tìm thấy người dùng.');
      }

      // Check email uniqueness if email is changed
      if (userData.email && userData.email.toLowerCase() !== users[userIndex].email.toLowerCase()) {
        if (users.some(u => u.email.toLowerCase() === userData.email!.toLowerCase())) {
          throw new Error('Email đã được sử dụng bởi tài khoản khác.');
        }
      }

      const updatedUser = {
        ...users[userIndex],
        ...userData,
      };

      users[userIndex] = updatedUser;
      saveLocalUsers(users);
      return updatedUser;
    }
    return apiClient.put<UserProfile>(`/users/${id}`, userData);
  },

  async deleteUser(id: string): Promise<void> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const users = getLocalUsers();
      const filtered = users.filter(u => u.id !== id);
      saveLocalUsers(filtered);
      return;
    }
    return apiClient.delete<void>(`/users/${id}`);
  },

  async toggleUserStatus(id: string): Promise<UserProfile> {
    if (USE_MOCK_API) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const users = getLocalUsers();
      const userIndex = users.findIndex(u => u.id === id);
      
      if (userIndex === -1) {
        throw new Error('Không tìm thấy người dùng.');
      }

      const user = users[userIndex];
      const updatedUser: UserProfile = {
        ...user,
        status: user.status === 'active' ? 'locked' : 'active',
      };

      users[userIndex] = updatedUser;
      saveLocalUsers(users);
      return updatedUser;
    }
    return apiClient.post<UserProfile>(`/users/${id}/toggle-status`, {});
  }
};
