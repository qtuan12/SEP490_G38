import { apiClient } from './api';
import type { MaterialCategory, CreateMaterialCategoryRequest, UpdateMaterialCategoryRequest } from '../types/materialCategory';
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

export const materialCategoryService = {
  getCategories: async (params?: { pageNumber?: number; pageSize?: number; search?: string }): Promise<PagedList<MaterialCategory>> => {
    return unwrap(await apiClient.get<ApiResponse<PagedList<MaterialCategory>>>('/MaterialCategories', {
      params: {
        pageNumber: params?.pageNumber?.toString() || '1',
        pageSize: params?.pageSize?.toString() || '10',
        ...(params?.search ? { search: params.search } : {})
      }
    }));
  },
  createCategory: async (data: CreateMaterialCategoryRequest): Promise<ApiResult<number>> => {
    return unwrapWithMessage(await apiClient.post<ApiResponse<number>>('/MaterialCategories', data));
  },
  updateCategory: async (id: number, data: UpdateMaterialCategoryRequest): Promise<ApiResult<MaterialCategory>> => {
    return unwrapWithMessage(await apiClient.put<ApiResponse<MaterialCategory>>(`/MaterialCategories/${id}`, data));
  },
  deleteCategory: async (id: number): Promise<ApiResult<null>> => {
    return unwrapWithMessage(await apiClient.delete<ApiResponse<null>>(`/MaterialCategories/${id}`));
  }
};
