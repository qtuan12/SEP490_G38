import { apiClient } from './api';
import type { MaterialCategory, CreateMaterialCategoryRequest, UpdateMaterialCategoryRequest } from '../types/materialCategory';
import type { PagedList } from './notificationService';

type ApiResponse<T> = { success: boolean; message?: string; data: T };

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return res.data;
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
  createCategory: async (data: CreateMaterialCategoryRequest): Promise<number> => {
    return unwrap(await apiClient.post<ApiResponse<number>>('/MaterialCategories', data));
  },
  updateCategory: async (id: number, data: UpdateMaterialCategoryRequest): Promise<MaterialCategory> => {
    return unwrap(await apiClient.put<ApiResponse<MaterialCategory>>(`/MaterialCategories/${id}`, data));
  },
  deleteCategory: async (id: number): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(`/MaterialCategories/${id}`);
  }
};
