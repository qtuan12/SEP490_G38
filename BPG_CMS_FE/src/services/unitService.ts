import { apiClient } from './api';
import type { Unit, CreateUnitRequest, UpdateUnitRequest } from '../types/unit';
import type { PagedList } from './notificationService';

type ApiResponse<T> = { success: boolean; message?: string; data: T };

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return res.data;
};

export const unitService = {
  getUnits: async (params?: { pageNumber?: number; pageSize?: number; search?: string }): Promise<PagedList<Unit>> => {
    return unwrap(await apiClient.get<ApiResponse<PagedList<Unit>>>('/Units', {
      params: {
        pageNumber: params?.pageNumber?.toString() || '1',
        pageSize: params?.pageSize?.toString() || '10',
        ...(params?.search ? { search: params.search } : {})
      }
    }));
  },
  createUnit: async (data: CreateUnitRequest): Promise<number> => {
    return unwrap(await apiClient.post<ApiResponse<number>>('/Units', data));
  },
  updateUnit: async (id: number, data: UpdateUnitRequest): Promise<Unit> => {
    return unwrap(await apiClient.put<ApiResponse<Unit>>(`/Units/${id}`, data));
  },
  deleteUnit: async (id: number): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(`/Units/${id}`);
  }
};
