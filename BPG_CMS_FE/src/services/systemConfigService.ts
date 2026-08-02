import { apiClient } from './api';
import type { ApiResponse, ApiResult } from '../types/api';

export interface SystemConfigDto {
  configKey: string;
  configValue: string;
  dataType: string;
  displayName: string;
  description?: string;
  unit?: string;
  updatedAt?: string;
}

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return res.data;
};

const unwrapWithMessage = <T>(res: ApiResponse<T>): ApiResult<T> => {
  if (!res.success) throw new Error(res.message || 'Không thể xử lý yêu cầu.');
  return { data: res.data, message: res.message || '' };
};

export interface CompanyInfoDto {
  companyName: string;
  companyLogoUrl: string;
}

export const systemConfigService = {
  getAll: async (): Promise<SystemConfigDto[]> =>
    unwrap(await apiClient.get<ApiResponse<SystemConfigDto[]>>('/systemconfigs')),

  update: async (configKey: string, configValue: string): Promise<ApiResult<boolean>> =>
    unwrapWithMessage(
      await apiClient.put<ApiResponse<boolean>>(`/systemconfigs/${encodeURIComponent(configKey)}`, { configValue })
    ),

  getCompanyInfo: async (): Promise<CompanyInfoDto> =>
    unwrap(await apiClient.get<ApiResponse<CompanyInfoDto>>('/systemconfigs/company')),

  updateCompanySettings: async (companyName: string, companyLogoUrl: string): Promise<ApiResult<boolean>> =>
    unwrapWithMessage(
      await apiClient.put<ApiResponse<boolean>>('/systemconfigs/company', { companyName, companyLogoUrl })
    ),
};
