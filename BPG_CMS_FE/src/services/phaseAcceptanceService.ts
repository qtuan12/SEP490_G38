import { apiClient } from './api';
import type { PagedResult } from '../types/common';
import type {
  PhaseAcceptance,
  GetPhaseAcceptancesQuery,
  AcceptPhaseCommand,
  CancelAcceptanceRequest
} from '../types/phaseAcceptance';
import type { ApiResult } from '../types/api';

const API_PATH = '/PhaseAcceptances';

type ApiResponse<T> = { success: boolean; message?: string; data: T };

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return res.data;
};

const unwrapWithMessage = <T>(res: ApiResponse<T>): ApiResult<T> => {
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return { data: res.data, message: res.message || '' };
};

export const phaseAcceptanceService = {
  getPhaseAcceptances: async (params: GetPhaseAcceptancesQuery): Promise<PagedResult<PhaseAcceptance>> => {
    const queryParams = new URLSearchParams();
    queryParams.append('PageNumber', params.pageIndex.toString());
    queryParams.append('PageSize', params.pageSize.toString());
    if (params.phaseId) queryParams.append('PhaseId', params.phaseId.toString());

    const endpoint = params.projectId
      ? `/projects/${params.projectId}/phase-acceptances`
      : API_PATH;
    const res = await apiClient.get<ApiResponse<PagedResult<PhaseAcceptance>>>(`${endpoint}?${queryParams.toString()}`);
    return unwrap(res);
  },

  acceptPhase: async (command: AcceptPhaseCommand): Promise<ApiResult<{ acceptanceId: number }>> => {
    const res = await apiClient.post<ApiResponse<{ acceptanceId: number }>>(API_PATH, command);
    return unwrapWithMessage(res);
  },

  cancelAcceptance: async (id: number, request: CancelAcceptanceRequest): Promise<string> => {
    const res = await apiClient.put<ApiResponse<string>>(`${API_PATH}/${id}/cancel`, request);
    return res.message || unwrap(res);
  }
};
