import { apiClient } from './api';
import type { Notification } from '../types/notification';
import type { ApiResult } from '../types/api';

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
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return res.data;
};

const unwrapWithMessage = <T>(res: ApiResponse<T>): ApiResult<T> => {
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return { data: res.data, message: res.message || '' };
};

export const notificationService = {
  async getNotifications(page: number = 1, size: number = 10): Promise<PagedList<Notification>> {
    return unwrap(
      await apiClient.get<ApiResponse<PagedList<Notification>>>(
        `/notifications?pageNumber=${page}&pageSize=${size}`
      )
    );
  },

  async getUnreadCount(): Promise<number> {
    return unwrap(
      await apiClient.get<ApiResponse<number>>('/notifications/unread-count')
    );
  },

  async markAsRead(notificationId?: number, markAll: boolean = false): Promise<ApiResult<boolean>> {
    return unwrapWithMessage(
      await apiClient.post<ApiResponse<boolean>>('/notifications/mark-read', {
        notificationId,
        markAll
      })
    );
  }
};
