import { apiClient } from './api';
import type { Unit, CreateUnitRequest, UpdateUnitRequest } from '../types/unit';
import type { PagedList } from './notificationService';
import type { ApiResult } from '../types/api';

type ApiResponse<T> = { success: boolean; message?: string; data: T };

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return res.data;
};

const unwrapWithMessage = <T>(res: ApiResponse<T>): ApiResult<T> => {
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return { data: res.data, message: res.message || '' };
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
  createUnit: async (data: CreateUnitRequest): Promise<ApiResult<number>> => {
    return unwrapWithMessage(await apiClient.post<ApiResponse<number>>('/Units', data));
  },
  updateUnit: async (id: number, data: UpdateUnitRequest): Promise<ApiResult<Unit>> => {
    return unwrapWithMessage(await apiClient.put<ApiResponse<Unit>>(`/Units/${id}`, data));
  },
  deleteUnit: async (id: number): Promise<ApiResult<null>> => {
    return unwrapWithMessage(await apiClient.delete<ApiResponse<null>>(`/Units/${id}`));
  }
};
