import { apiClient } from './api';
import type {
  MaterialCatalog,
  CreateMaterialCatalogRequest,
  UpdateMaterialCatalogRequest,
  MaterialConversion,
  MaterialConversionRequest
} from '../types/material';
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

export const materialService = {
  getMaterials: async (params?: { pageNumber?: number; pageSize?: number; search?: string; categoryId?: number }): Promise<PagedList<MaterialCatalog>> => {
    const queryParams: Record<string, string> = {
      pageNumber: params?.pageNumber?.toString() || '1',
      pageSize: params?.pageSize?.toString() || '10'
    };
    if (params?.search) queryParams.search = params.search;
    if (params?.categoryId) queryParams.categoryId = params.categoryId.toString();

    return unwrap(await apiClient.get<ApiResponse<PagedList<MaterialCatalog>>>('/MaterialCatalogs', {
      params: queryParams
    }));
  },
  createMaterial: async (data: CreateMaterialCatalogRequest): Promise<ApiResult<number>> => {
    return unwrapWithMessage(await apiClient.post<ApiResponse<number>>('/MaterialCatalogs', data));
  },
  updateMaterial: async (id: number, data: UpdateMaterialCatalogRequest): Promise<ApiResult<MaterialCatalog>> => {
    return unwrapWithMessage(await apiClient.put<ApiResponse<MaterialCatalog>>(`/MaterialCatalogs/${id}`, data));
  },
  deleteMaterial: async (id: number): Promise<ApiResult<null>> => {
    return unwrapWithMessage(await apiClient.delete<ApiResponse<null>>(`/MaterialCatalogs/${id}`));
  },

  getConversions: async (materialId: number): Promise<MaterialConversion[]> => {
    return unwrap(await apiClient.get<ApiResponse<MaterialConversion[]>>(`/MaterialCatalogs/${materialId}/conversions`));
  },
  syncConversions: async (materialId: number, data: MaterialConversionRequest[]): Promise<ApiResult<MaterialConversion[]>> => {
    return unwrapWithMessage(await apiClient.put<ApiResponse<MaterialConversion[]>>(`/MaterialCatalogs/${materialId}/conversions`, data));
  }
};
