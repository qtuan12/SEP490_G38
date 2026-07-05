import { apiClient } from './api';
import type { ApiPagedResponse, ApiResponse, PagedList } from '../types/api';

export interface DirectPurchaseRequestDto {
  directPurchaseId: number;
  requestNumber: string;
  projectId: number;
  projectName: string;
  phaseName: string;
  requesterName: string;
  reason: string;
  totalAmount: number;
  purchaseDate: string;
  status: string;
  auditStatus: string;
  auditNote?: string;
  auditorName?: string;
  auditedAt?: string;
  itemCount: number;
  createdAt: string;
}

export interface GetDirectPurchaseRequestsParams {
  pageNumber?: number;
  pageSize?: number;
  projectId?: number;
  status?: string;
  auditStatus?: string;
  requestedBy?: number;
}

export interface PhaseBOQItemDto {
  boqItemId: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  materialSpec?: string;
  unitId: number;
  unitName: string;
  boqQuantity: number;
  conversionRate: number;
  alreadyConsumed: number;
  remainingQuantity: number;
}

export interface CreateDirectPurchaseItemInput {
  materialId: number;
  quantity: number;
  unitPrice: number;
}

export interface CreateDirectPurchaseRequestPayload {
  projectId: number;
  phaseId: number;
  taskId?: number;
  reason: string;
  purchaseDate: string;
  items: CreateDirectPurchaseItemInput[];
  invoicePhotoUrls: string[];
}

export interface DirectPurchaseItemDetailDto {
  materialId: number;
  materialCode: string;
  materialName: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface DirectPurchaseDetailDto {
  directPurchaseId: number;
  requestNumber: string;
  projectId: number;
  projectName: string;
  phaseName: string;
  requesterName: string;
  reason: string;
  totalAmount: number;
  purchaseDate: string;
  status: string;
  auditStatus: string;
  auditNote?: string;
  auditorName?: string;
  auditedAt?: string;
  autoPONumber?: string;
  autoReceiptNo?: string;
  createdAt: string;
  items: DirectPurchaseItemDetailDto[];
  invoicePhotoUrls: string[];
}

export interface AuditDirectPurchasePayload {
  approve: boolean;
  auditNote?: string;
}

const unwrapPaged = <T>(res: ApiPagedResponse<T>): PagedList<T> => {
  if (!res.success) throw new Error(res.message || 'Yêu cầu thất bại.');
  return res.data;
};

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Yêu cầu thất bại.');
  return res.data;
};

export const directPurchaseService = {
  getList: async (params: GetDirectPurchaseRequestsParams = {}): Promise<PagedList<DirectPurchaseRequestDto>> => {
    const query = new URLSearchParams();
    if (params.pageNumber) query.set('pageNumber', String(params.pageNumber));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.projectId) query.set('projectId', String(params.projectId));
    if (params.status) query.set('status', params.status);
    if (params.auditStatus) query.set('auditStatus', params.auditStatus);
    if (params.requestedBy) query.set('requestedBy', String(params.requestedBy));
    return unwrapPaged(
      await apiClient.get<ApiPagedResponse<DirectPurchaseRequestDto>>(`/directpurchases?${query.toString()}`)
    );
  },

  getPhaseBOQ: async (projectId: number, phaseId: number): Promise<PhaseBOQItemDto[]> => {
    return unwrap(
      await apiClient.get<ApiResponse<PhaseBOQItemDto[]>>(`/projects/${projectId}/phases/${phaseId}/boq`)
    );
  },

  create: async (payload: CreateDirectPurchaseRequestPayload): Promise<{ directPurchaseId: number }> => {
    return unwrap(
      await apiClient.post<ApiResponse<{ directPurchaseId: number }>>('/directpurchases', payload)
    );
  },

  getById: async (id: number): Promise<DirectPurchaseDetailDto> => {
    return unwrap(
      await apiClient.get<ApiResponse<DirectPurchaseDetailDto>>(`/directpurchases/${id}`)
    );
  },

  audit: async (id: number, payload: AuditDirectPurchasePayload): Promise<boolean> => {
    return unwrap(
      await apiClient.patch<ApiResponse<boolean>>(`/directpurchases/${id}/audit`, payload)
    );
  },
};
