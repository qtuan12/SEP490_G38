import { apiClient } from './api';
import type { 
  MaterialCatalog, 
  CreateMaterialCatalogRequest, 
  UpdateMaterialCatalogRequest,
  MaterialConversion,
  MaterialConversionRequest
} from '../types/material';
import type { PagedList } from './notificationService';

type ApiResponse<T> = { success: boolean; message?: string; data: T };

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Yêu cầu thất bại.');
  return res.data;
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
  createMaterial: async (data: CreateMaterialCatalogRequest): Promise<number> => {
    return unwrap(await apiClient.post<ApiResponse<number>>('/MaterialCatalogs', data));
  },
  updateMaterial: async (id: number, data: UpdateMaterialCatalogRequest): Promise<MaterialCatalog> => {
    return unwrap(await apiClient.put<ApiResponse<MaterialCatalog>>(`/MaterialCatalogs/${id}`, data));
  },
  deleteMaterial: async (id: number): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(`/MaterialCatalogs/${id}`);
  },

  getConversions: async (materialId: number): Promise<MaterialConversion[]> => {
    return unwrap(await apiClient.get<ApiResponse<MaterialConversion[]>>(`/MaterialCatalogs/${materialId}/conversions`));
  },
  syncConversions: async (materialId: number, data: MaterialConversionRequest[]): Promise<MaterialConversion[]> => {
    return unwrap(await apiClient.put<ApiResponse<MaterialConversion[]>>(`/MaterialCatalogs/${materialId}/conversions`, data));
  }
};
