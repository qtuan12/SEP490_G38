import { apiClient } from './api';
import type { ApiPagedResponse, ApiResponse, ApiResult, PagedList } from '../types/api';

/** Trạng thái duyệt chi. Không gác tồn kho - tồn kho cộng ngay ở bước Submit. */
export const DP_STATUS = {
  Draft: 'Draft',
  Pending: 'Pending',
  WaitingApproval: 'WaitingApproval',
  Approved: 'Approved',
  Rejected: 'Rejected',
} as const;

export const DP_AUDIT_STATUS = {
  PendingAudit: 'PendingAudit',
  Audited: 'Audited',
  Rejected: 'Rejected',
} as const;

export const DP_BOQ_CHECK = {
  WithinBOQ: 'WithinBOQ',
  OverBOQ: 'OverBOQ',
} as const;

/**
 * Nhãn trạng thái phiếu. Đây là trục trạng thái DUY NHẤT hiển thị ở danh sách:
 * AuditStatus đã dính chặt vào Status nên hiện thêm chỉ lặp lại thông tin.
 * Lý do từ chối (hóa đơn sai hay Giám đốc không duyệt chi) nằm ở phần ghi chú
 * trong modal chi tiết, không tách thành trạng thái riêng.
 */
export const DP_STATUS_LABEL: Record<string, string> = {
  Draft: 'Nháp',
  Pending: 'Chờ Kế toán',
  WaitingApproval: 'Chờ Giám đốc',
  Approved: 'Đã duyệt',
  Rejected: 'Từ chối',
};

export interface DirectPurchaseRequestDto {
  directPurchaseId: number;
  requestNumber: string;
  projectId: number;
  projectName: string;
  phaseName: string;
  requestedBy: number;
  requesterName: string;
  reason: string;
  totalAmount: number;
  purchaseDate: string;
  status: string;
  auditStatus: string;
  boqCheckStatus: string;
  auditNote?: string;
  auditorName?: string;
  auditedAt?: string;
  approvalNote?: string;
  approverName?: string;
  approvedAt?: string;
  itemCount: number;
  createdAt: string;
}

export interface GetDirectPurchaseRequestsParams {
  pageNumber?: number;
  pageSize?: number;
  projectId?: number;
  status?: string;
  auditStatus?: string;
  boqCheckStatus?: string;
  requestedBy?: number;
  searchTerm?: string;
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
  /**
   * Đơn vị người dùng chọn: đơn vị cơ bản của vật tư hoặc một đơn vị trong bảng quy đổi.
   * Để trống thì backend tự suy ra (đơn vị dòng BOQ nếu có, ngược lại là đơn vị cơ bản).
   * Tỷ lệ quy đổi không gửi kèm — backend luôn tra lại từ DB.
   */
  unitId?: number;
  quantity: number;
  unitPrice: number;
}

export interface CreateDirectPurchaseRequestPayload {
  projectId: number;
  phaseId: number;
  taskId?: number;
  /** Lý do mua khẩn cấp - cũng là phần giải trình khi phiếu vượt định mức BOQ. */
  reason: string;
  purchaseDate: string;
  items: CreateDirectPurchaseItemInput[];
  invoicePhotoUrls: string[];
}

export interface UpdateDirectPurchaseDraftPayload {
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
  unitId: number;
  unitName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isOverBOQ: boolean;
  explanation?: string;
}

export interface DirectPurchaseDetailDto {
  directPurchaseId: number;
  requestNumber: string;
  projectId: number;
  projectName: string;
  phaseId: number;
  phaseName: string;
  requestedBy: number;
  requesterName: string;
  reason: string;
  totalAmount: number;
  purchaseDate: string;
  status: string;
  auditStatus: string;
  boqCheckStatus: string;
  submittedAt?: string;
  auditNote?: string;
  auditorName?: string;
  auditedAt?: string;
  approvalNote?: string;
  approverName?: string;
  approvedAt?: string;
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

export interface DirectorApproveDirectPurchasePayload {
  approvalNote?: string;
}

export interface DirectorRejectDirectPurchasePayload {
  reason: string;
}

const unwrapPaged = <T>(res: ApiPagedResponse<T>): PagedList<T> => {
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return res.data;
};

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || '\u004b\u0068\u00f4\u006e\u0067 \u0074\u0068\u1ec3 \u0078\u1eed \u006c\u00fd \u0079\u00eau \u0063\u1ea7\u0075.');
  return res.data;
};

const unwrapWithMessage = <T>(res: ApiResponse<T>): ApiResult<T> => {
  if (!res.success) throw new Error(res.message || '\u004b\u0068\u00f4\u006e\u0067 \u0074\u0068\u1ec3 \u0078\u1eed \u006c\u00fd \u0079\u00eau \u0063\u1ea7\u0075.');
  return { data: res.data, message: res.message || '' };
};

export const directPurchaseService = {
  getList: async (params: GetDirectPurchaseRequestsParams = {}): Promise<PagedList<DirectPurchaseRequestDto>> => {
    const query = new URLSearchParams();
    if (params.pageNumber) query.set('pageNumber', String(params.pageNumber));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.projectId) query.set('projectId', String(params.projectId));
    if (params.status) query.set('status', params.status);
    if (params.auditStatus) query.set('auditStatus', params.auditStatus);
    if (params.boqCheckStatus) query.set('boqCheckStatus', params.boqCheckStatus);
    if (params.requestedBy) query.set('requestedBy', String(params.requestedBy));
    if (params.searchTerm) query.set('searchTerm', params.searchTerm);
    return unwrapPaged(
      await apiClient.get<ApiPagedResponse<DirectPurchaseRequestDto>>(`/directpurchases?${query.toString()}`)
    );
  },

  getPhaseBOQ: async (projectId: number, phaseId: number): Promise<PhaseBOQItemDto[]> => {
    return unwrap(
      await apiClient.get<ApiResponse<PhaseBOQItemDto[]>>(`/projects/${projectId}/phases/${phaseId}/boq`)
    );
  },

  /** Tạo phiếu NHÁP. Chưa sinh Đơn hàng/Phiếu nhập kho/tồn kho. */
  create: async (payload: CreateDirectPurchaseRequestPayload): Promise<ApiResult<{ directPurchaseId: number }>> => {
    return unwrapWithMessage(
      await apiClient.post<ApiResponse<{ directPurchaseId: number }>>('/directpurchases', payload)
    );
  },

  updateDraft: async (id: number, payload: UpdateDirectPurchaseDraftPayload): Promise<ApiResult<boolean>> => {
    return unwrapWithMessage(
      await apiClient.put<ApiResponse<boolean>>(`/directpurchases/${id}`, payload)
    );
  },

  deleteDraft: async (id: number): Promise<ApiResult<boolean>> => {
    return unwrapWithMessage(
      await apiClient.delete<ApiResponse<boolean>>(`/directpurchases/${id}`)
    );
  },

  /** Gửi phiếu: validate đầy đủ, cộng tồn kho, không thể quay lại. */
  submit: async (id: number): Promise<ApiResult<boolean>> => {
    return unwrapWithMessage(
      await apiClient.post<ApiResponse<boolean>>(`/directpurchases/${id}/submit`, {})
    );
  },

  getById: async (id: number): Promise<DirectPurchaseDetailDto> => {
    return unwrap(
      await apiClient.get<ApiResponse<DirectPurchaseDetailDto>>(`/directpurchases/${id}`)
    );
  },

  audit: async (id: number, payload: AuditDirectPurchasePayload): Promise<ApiResult<boolean>> => {
    return unwrapWithMessage(
      await apiClient.patch<ApiResponse<boolean>>(`/directpurchases/${id}/audit`, payload)
    );
  },

  directorApprove: async (id: number, payload: DirectorApproveDirectPurchasePayload): Promise<ApiResult<boolean>> => {
    return unwrapWithMessage(
      await apiClient.patch<ApiResponse<boolean>>(`/directpurchases/${id}/director-approve`, payload)
    );
  },

  directorReject: async (id: number, payload: DirectorRejectDirectPurchasePayload): Promise<ApiResult<boolean>> => {
    return unwrapWithMessage(
      await apiClient.patch<ApiResponse<boolean>>(`/directpurchases/${id}/reject`, payload)
    );
  },
};
