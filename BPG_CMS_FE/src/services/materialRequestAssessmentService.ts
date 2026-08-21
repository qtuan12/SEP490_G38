import { apiClient } from './api';
import type { ApiResponse } from '../types/api';

export interface MaterialRequestActiveSupply {
  poId: number;
  poNumber: string;
  remainingQuantity: number;
}

export interface MaterialRequestInternalSource {
  projectId: number;
  projectName: string;
  availableQuantity: number;
}

export interface MaterialRequestLastPurchasePrice {
  poId: number;
  poNumber: string;
  unitPrice: number;
  orderDate: string;
}

export interface MaterialRequestAssessmentItem {
  requestItemId: number;
  materialId: number;
  unitId: number;
  unitName: string;
  projectInventoryQuantity: number;
  activeSupplies: MaterialRequestActiveSupply[];
  internalSources: MaterialRequestInternalSource[];
  lastPurchasePrice?: MaterialRequestLastPurchasePrice;
}

export interface MaterialRequestAssessment {
  requestId: number;
  projectId: number;
  items: MaterialRequestAssessmentItem[];
}

export const materialRequestAssessmentService = {
  async getByRequestId(requestId: number): Promise<MaterialRequestAssessment> {
    const response = await apiClient.get<ApiResponse<MaterialRequestAssessment>>(
      `/materialrequests/${requestId}/assessment`,
    );
    if (!response.success) {
      throw new Error(response.message || 'Không thể tải cơ sở thẩm định yêu cầu vật tư.');
    }
    return response.data;
  },
};
