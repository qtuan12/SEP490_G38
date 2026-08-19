import { apiClient } from './api';
import type { Supplier, GetSuppliersQuery, ImportSuppliersResult } from '../types/supplier';
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

export const supplierService = {
  async getSuppliers(query: GetSuppliersQuery): Promise<PagedList<Supplier>> {
    const params: Record<string, string> = {};
    if (query.pageNumber) params.pageNumber = query.pageNumber.toString();
    if (query.pageSize) params.pageSize = query.pageSize.toString();
    if (query.search) params.search = query.search;
    if (query.sortBy) params.sortBy = query.sortBy;
    if (query.sortDescending !== undefined) params.sortDescending = query.sortDescending.toString();
    if (query.collaborationStatus) params.collaborationStatus = query.collaborationStatus;

    return unwrap(
      await apiClient.get<ApiResponse<PagedList<Supplier>>>('/suppliers', { params })
    );
  },

  async getSupplierById(id: number): Promise<Supplier> {
    return unwrap(await apiClient.get<ApiResponse<Supplier>>(`/suppliers/${id}`));
  },

  async createSupplier(supplierData: Omit<Supplier, 'supplierId'>): Promise<ApiResult<Supplier>> {
    return unwrapWithMessage(await apiClient.post<ApiResponse<Supplier>>('/suppliers', supplierData));
  },

  async updateSupplier(id: number, supplierData: Omit<Supplier, 'supplierId'>): Promise<ApiResult<Supplier>> {
    return unwrapWithMessage(await apiClient.put<ApiResponse<Supplier>>(`/suppliers/${id}`, supplierData));
  },

  async deleteSupplier(id: number): Promise<ApiResult<null>> {
    return unwrapWithMessage(await apiClient.delete<ApiResponse<null>>(`/suppliers/${id}`));
  },

  async importSuppliers(file: File): Promise<ApiResult<ImportSuppliersResult>> {
    const formData = new FormData();
    formData.append('file', file);
    return unwrapWithMessage(
      await apiClient.post<ApiResponse<ImportSuppliersResult>>('/suppliers/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    );
  },
};
