import { apiClient } from './api';
import type {
  PagedResult,
  Unit,
  CreateUnitRequest,
  UpdateUnitRequest,
  MaterialCategory,
  CreateMaterialCategoryRequest,
  UpdateMaterialCategoryRequest,
  MaterialCatalog,
  CreateMaterialCatalogRequest,
  UpdateMaterialCatalogRequest,
  MaterialConversion,
  MaterialConversionRequest
} from '../types/masterData';

type ApiResponse<T> = { success: boolean; message?: string; data: T };

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return res.data;
};

export const masterDataService = {
  // ---- UNITS ----
  getUnits: async (params?: { pageNumber?: number; pageSize?: number; search?: string }) => {
    return unwrap(await apiClient.get<ApiResponse<PagedResult<Unit>>>('/Units', {
      params: {
        pageNumber: params?.pageNumber?.toString() || '1',
        pageSize: params?.pageSize?.toString() || '10',
        ...(params?.search ? { search: params.search } : {})
      }
    }));
  },
  createUnit: async (data: CreateUnitRequest) => {
    return unwrap(await apiClient.post<ApiResponse<number>>('/Units', data));
  },
  updateUnit: async (id: number, data: UpdateUnitRequest) => {
    return unwrap(await apiClient.put<ApiResponse<Unit>>(`/Units/${id}`, data));
  },
  deleteUnit: async (id: number) => {
    await apiClient.delete<ApiResponse<null>>(`/Units/${id}`);
  },

  // ---- MATERIAL CATEGORIES ----
  getCategories: async (params?: { pageNumber?: number; pageSize?: number; search?: string }) => {
    return unwrap(await apiClient.get<ApiResponse<PagedResult<MaterialCategory>>>('/MaterialCategories', {
      params: {
        pageNumber: params?.pageNumber?.toString() || '1',
        pageSize: params?.pageSize?.toString() || '10',
        ...(params?.search ? { search: params.search } : {})
      }
    }));
  },
  createCategory: async (data: CreateMaterialCategoryRequest) => {
    return unwrap(await apiClient.post<ApiResponse<number>>('/MaterialCategories', data));
  },
  updateCategory: async (id: number, data: UpdateMaterialCategoryRequest) => {
    return unwrap(await apiClient.put<ApiResponse<MaterialCategory>>(`/MaterialCategories/${id}`, data));
  },
  deleteCategory: async (id: number) => {
    await apiClient.delete<ApiResponse<null>>(`/MaterialCategories/${id}`);
  },

  // ---- MATERIAL CATALOGS ----
  getMaterials: async (params?: { pageNumber?: number; pageSize?: number; search?: string; categoryId?: number }) => {
    const queryParams: any = {
      pageNumber: params?.pageNumber?.toString() || '1',
      pageSize: params?.pageSize?.toString() || '10'
    };
    if (params?.search) queryParams.search = params.search;
    if (params?.categoryId) queryParams.categoryId = params.categoryId.toString();

    return unwrap(await apiClient.get<ApiResponse<PagedResult<MaterialCatalog>>>('/MaterialCatalogs', {
      params: queryParams
    }));
  },
  createMaterial: async (data: CreateMaterialCatalogRequest) => {
    return unwrap(await apiClient.post<ApiResponse<number>>('/MaterialCatalogs', data));
  },
  updateMaterial: async (id: number, data: UpdateMaterialCatalogRequest) => {
    return unwrap(await apiClient.put<ApiResponse<MaterialCatalog>>(`/MaterialCatalogs/${id}`, data));
  },
  deleteMaterial: async (id: number) => {
    await apiClient.delete<ApiResponse<null>>(`/MaterialCatalogs/${id}`);
  },

  // ---- MATERIAL CONVERSIONS ----
  getConversions: async (materialId: number) => {
    return unwrap(await apiClient.get<ApiResponse<MaterialConversion[]>>(`/MaterialCatalogs/${materialId}/conversions`));
  },
  syncConversions: async (materialId: number, data: MaterialConversionRequest[]) => {
    return unwrap(await apiClient.put<ApiResponse<MaterialConversion[]>>(`/MaterialCatalogs/${materialId}/conversions`, data));
  }
};
