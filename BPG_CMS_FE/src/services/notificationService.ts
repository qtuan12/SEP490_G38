import { apiClient } from './api';
import type { Notification } from '../types/notification';

export interface PagedList<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

type ApiResponse<T> = { success: boolean; message?: string; data: T };

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Yêu cầu thất bại.');
  return res.data;
};

export const notificationService = {
  async getNotifications(page: number = 1, size: number = 10): Promise<PagedList<Notification>> {
    return unwrap(
      await apiClient.get<ApiResponse<PagedList<Notification>>>(
        `/notifications?pageNumber=${page}&pageSize=${size}`
      )
    );
  },

  async markAsRead(notificationId?: number, markAll: boolean = false): Promise<boolean> {
    return unwrap(
      await apiClient.post<ApiResponse<boolean>>('/notifications/mark-read', {
        notificationId,
        markAll
      })
    );
  }
};
