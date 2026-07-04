import { apiClient } from './api';
import type { ApiResponse } from '../types/api';

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
  if (!res.success) throw new Error(res.message || 'Yêu cầu thất bại.');
  return res.data;
};

export const systemConfigService = {
  getAll: async (): Promise<SystemConfigDto[]> =>
    unwrap(await apiClient.get<ApiResponse<SystemConfigDto[]>>('/systemconfigs')),

  update: async (configKey: string, configValue: string): Promise<boolean> =>
    unwrap(
      await apiClient.put<ApiResponse<boolean>>(`/systemconfigs/${encodeURIComponent(configKey)}`, { configValue })
    ),
};
