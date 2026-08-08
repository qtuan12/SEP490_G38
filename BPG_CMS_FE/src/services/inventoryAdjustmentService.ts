import { apiClient } from './api';
import type { ApiResponse, ApiResult, PagedList } from '../types/api';

export interface AdjustmentItemDto {
  adjustmentItemId: number;
  adjustmentId: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  specification: string;
  unitId: number;
  unitName: string;
  quantity: number;
  conversionRate: number;
}

export interface InventoryAdjustmentDto {
  adjustmentId: number;
  projectId: number;
  projectName: string;
  phaseId: number;
  phaseName: string;
  incidentId?: number | null;
  adjustmentType: string;
  reason: string;
  description: string | null;
  status: string;
  createdBy: number | null;
  createdAt: string;
  approvedBy: number | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  creatorName: string;
  approverName: string;
  items: AdjustmentItemDto[];
}

export interface CreateIncreaseAdjustmentCommand {
  phaseId: number;
  reason: string;
  description?: string;
  items: { materialId: number; quantity: number }[];
}

export interface CreateDecreaseAdjustmentCommand {
  phaseId: number;
  incidentId?: number;
  reason: string;
  description?: string;
  items: { materialId: number; quantity: number }[];
}

export interface ApproveDecreaseAdjustmentCommand {
  isApproved: boolean;
  rejectedReason?: string;
}

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return res.data;
};

const unwrapWithMessage = <T>(res: ApiResponse<T>): ApiResult<T> => {
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return { data: res.data, message: res.message };
};

export const inventoryAdjustmentService = {
  getAdjustments: async (
    projectId: number,
    params?: {
      pageNumber?: number;
      pageSize?: number;
      adjustmentType?: string;
      status?: string;
      searchTerm?: string;
    }
  ): Promise<PagedList<InventoryAdjustmentDto>> => {
    const queryParams: Record<string, string> = {};
    if (params?.pageNumber) queryParams.pageNumber = params.pageNumber.toString();
    if (params?.pageSize) queryParams.pageSize = params.pageSize.toString();
    if (params?.adjustmentType) queryParams.adjustmentType = params.adjustmentType;
    if (params?.status) queryParams.status = params.status;
    if (params?.searchTerm) queryParams.searchTerm = params.searchTerm;

    return unwrap(
      await apiClient.get<ApiResponse<PagedList<InventoryAdjustmentDto>>>(
        `/projects/${projectId}/inventory-adjustments`,
        { params: queryParams }
      )
    );
  },

  createIncrease: async (projectId: number, command: CreateIncreaseAdjustmentCommand): Promise<ApiResult<number>> => {
    return unwrapWithMessage(
      await apiClient.post<ApiResponse<number>>(`/projects/${projectId}/inventory-adjustments/increase`, command)
    );
  },

  createDecrease: async (projectId: number, command: CreateDecreaseAdjustmentCommand): Promise<ApiResult<number>> => {
    return unwrapWithMessage(
      await apiClient.post<ApiResponse<number>>(`/projects/${projectId}/inventory-adjustments/decrease`, command)
    );
  },

  approveDecrease: async (projectId: number, id: number, command: ApproveDecreaseAdjustmentCommand): Promise<ApiResult<boolean>> => {
    return unwrapWithMessage(
      await apiClient.put<ApiResponse<boolean>>(`/projects/${projectId}/inventory-adjustments/${id}/approve`, command)
    );
  }
};
