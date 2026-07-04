import { apiClient } from './api';
import type { ApiResponse, PagedList } from '../types/api';

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
  reason: string;
  description?: string;
  items: { materialId: number; quantity: number }[];
}

export interface CreateDecreaseAdjustmentCommand {
  phaseId: number;
  reason: string;
  description?: string;
  items: { materialId: number; quantity: number }[];
}

export interface ApproveDecreaseAdjustmentCommand {
  isApproved: boolean;
  rejectedReason?: string;
}

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Yêu cầu thất bại.');
  return res.data;
};

export const inventoryAdjustmentService = {
  getAdjustments: async (
    projectId: number,
    params?: {
      pageNumber?: number;
      pageSize?: number;
      adjustmentType?: string;
      status?: string;
    }
  ): Promise<PagedList<InventoryAdjustmentDto>> => {
    const queryParams: Record<string, string> = {};
    if (params?.pageNumber) queryParams.pageNumber = params.pageNumber.toString();
    if (params?.pageSize) queryParams.pageSize = params.pageSize.toString();
    if (params?.adjustmentType) queryParams.adjustmentType = params.adjustmentType;
    if (params?.status) queryParams.status = params.status;

    return unwrap(
      await apiClient.get<ApiResponse<PagedList<InventoryAdjustmentDto>>>(
        `/projects/${projectId}/inventory-adjustments`,
        { params: queryParams }
      )
    );
  },

  createIncrease: async (projectId: number, command: CreateIncreaseAdjustmentCommand): Promise<number> => {
    return unwrap(
      await apiClient.post<ApiResponse<number>>(`/projects/${projectId}/inventory-adjustments/increase`, command)
    );
  },

  createDecrease: async (projectId: number, command: CreateDecreaseAdjustmentCommand): Promise<number> => {
    return unwrap(
      await apiClient.post<ApiResponse<number>>(`/projects/${projectId}/inventory-adjustments/decrease`, command)
    );
  },

  approveDecrease: async (projectId: number, id: number, command: ApproveDecreaseAdjustmentCommand): Promise<boolean> => {
    return unwrap(
      await apiClient.put<ApiResponse<boolean>>(`/projects/${projectId}/inventory-adjustments/${id}/approve`, command)
    );
  }
};
