import { apiClient } from './api';
import type { ApiResponse, PagedList } from '../types/api';
import type {
  SurplusRequest,
  SurplusRequestDetail,
  SurplusActionList,
} from '../types/surplus';

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Yêu cầu thất bại.');
  return res.data;
};

export const surplusService = {
  // ─── List ────────────────────────────────────────────────────────────────
  getList: async (params: {
    projectId?: number;
    status?: string;
    search?: string;
    pageNumber?: number;
    pageSize?: number;
  }): Promise<PagedList<SurplusRequest>> => {
    const q: Record<string, string> = {
      pageNumber: (params.pageNumber ?? 1).toString(),
      pageSize: (params.pageSize ?? 10).toString(),
    };
    if (params.projectId) q.projectId = params.projectId.toString();
    if (params.status) q.status = params.status;
    if (params.search) q.search = params.search;
    return unwrap(await apiClient.get<ApiResponse<PagedList<SurplusRequest>>>('/surplus', { params: q }));
  },

  // ─── Detail ───────────────────────────────────────────────────────────────
  getDetail: async (surplusRequestId: number): Promise<SurplusRequestDetail> =>
    unwrap(await apiClient.get<ApiResponse<SurplusRequestDetail>>(`/surplus/${surplusRequestId}`)),

  // ─── Action list of an item ───────────────────────────────────────────────
  getActionList: async (surplusRequestItemId: number): Promise<SurplusActionList> =>
    unwrap(await apiClient.get<ApiResponse<SurplusActionList>>(`/surplus/items/${surplusRequestItemId}/actions`)),

  // ─── Create batch (Leader) ────────────────────────────────────────────────
  createRequest: async (projectId: number, reason?: string): Promise<number> =>
    unwrap(await apiClient.post<ApiResponse<number>>(`/surplus/projects/${projectId}`, { reason })),

  // ─── Return to supplier (Accountant) ─────────────────────────────────────
  createReturn: async (
    surplusRequestItemId: number,
    formData: FormData
  ): Promise<number> =>
    unwrap(
      await apiClient.postFormData<ApiResponse<number>>(
        `/surplus/items/${surplusRequestItemId}/return`,
        formData
      )
    ),

  // ─── Transfer (Leader → TPKT → Dispatch → Receive) ───────────────────────
  createTransfer: async (
    surplusRequestItemId: number,
    body: { toProjectId: number; transferQuantity: number }
  ): Promise<number> =>
    unwrap(await apiClient.post<ApiResponse<number>>(`/surplus/items/${surplusRequestItemId}/transfer`, body)),

  reviewTransfer: async (surplusTransferId: number, isApproved: boolean): Promise<void> =>
    unwrap(await apiClient.put<ApiResponse<void>>(`/surplus/transfers/${surplusTransferId}/review`, { isApproved })),

  dispatchTransfer: async (surplusTransferId: number, formData: FormData): Promise<void> =>
    unwrap(await apiClient.putFormData<ApiResponse<void>>(`/surplus/transfers/${surplusTransferId}/dispatch`, formData)),

  receiveTransfer: async (surplusTransferId: number, formData: FormData): Promise<void> =>
    unwrap(await apiClient.putFormData<ApiResponse<void>>(`/surplus/transfers/${surplusTransferId}/receive`, formData)),

  // ─── Liquidation (Accountant) ─────────────────────────────────────────────
  createLiquidation: async (
    surplusRequestItemId: number,
    formData: FormData
  ): Promise<number> =>
    unwrap(
      await apiClient.postFormData<ApiResponse<number>>(
        `/surplus/items/${surplusRequestItemId}/liquidation`,
        formData
      )
    ),

  getIncomingTransfers: async (projectId: number): Promise<import('../types/surplus').IncomingTransfer[]> => {
    const res = await apiClient.get<ApiResponse<import('../types/surplus').IncomingTransfer[]>>(`/surplus/projects/${projectId}/incoming-transfers`);
    if (!res.success) throw new Error(res.message || 'Lỗi lấy danh sách vật tư chuyển đến');
    return res.data || [];
  },
};
