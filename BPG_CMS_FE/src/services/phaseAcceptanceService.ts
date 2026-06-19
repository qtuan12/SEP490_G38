import { apiClient } from './api';
import type { PagedResult } from '../types/common';
import type {
  PhaseAcceptance,
  GetPhaseAcceptancesQuery,
  AcceptPhaseCommand,
  CancelAcceptanceRequest
} from '../types/phaseAcceptance';

const API_PATH = '/PhaseAcceptances';

type ApiResponse<T> = { success: boolean; message?: string; data: T };

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Yêu cầu thất bại.');
  return res.data;
};

export const phaseAcceptanceService = {
  getPhaseAcceptances: async (params: GetPhaseAcceptancesQuery): Promise<PagedResult<PhaseAcceptance>> => {
    // PaginationRequest ở C# backend map với pageNumber chứ không phải pageIndex, ta truyền đúng name cho an toàn
    const queryParams = new URLSearchParams();
    queryParams.append('PageNumber', params.pageIndex.toString());
    queryParams.append('PageSize', params.pageSize.toString());
    if (params.projectId) queryParams.append('ProjectId', params.projectId.toString());
    if (params.phaseId) queryParams.append('PhaseId', params.phaseId.toString());

    const res = await apiClient.get<ApiResponse<PagedResult<PhaseAcceptance>>>(`${API_PATH}?${queryParams.toString()}`);
    return unwrap(res);
  },

  acceptPhase: async (command: AcceptPhaseCommand): Promise<{ acceptanceId: number }> => {
    const res = await apiClient.post<ApiResponse<{ acceptanceId: number }>>(API_PATH, command);
    return unwrap(res);
  },

  cancelAcceptance: async (id: number, request: CancelAcceptanceRequest): Promise<string> => {
    const res = await apiClient.put<ApiResponse<string>>(`${API_PATH}/${id}/cancel`, request);
    return unwrap(res);
  }
};
