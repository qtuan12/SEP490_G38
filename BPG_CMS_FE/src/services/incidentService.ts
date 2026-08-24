import { apiClient } from './api';
import type { ApiResponse, ApiResult } from '../types/api';

export interface IncidentDto {
  incidentId: number;
  projectId: number;
  projectName?: string;
  taskId?: number;
  taskName?: string;
  phaseId?: number;
  phaseName?: string;
  reportedBy: number;
  reporterName: string;
  reviewerBy?: number;
  reviewerName?: string;
  incidentType: string;
  description: string;
  status: string;
  latestAdjustmentId?: number;
  latestAdjustmentStatus?: string;
  damageDescription?: string;
  estimatedMaterialLoss?: number;
  estimatedLaborDays?: number;
  estimatedDelayDays?: number;
  proposedAction?: string;
  handlingInstruction?: string;
  reworkTaskId?: number;
  isEmergency?: boolean;
  recoveryPlanText?: string;
  recoveryEstimateCost?: number;
  createdAt: string;
  updatedAt?: string;
}

export const incidentService = {
  async getAllIncidents(): Promise<IncidentDto[]> {
    const response = await apiClient.get<ApiResponse<IncidentDto[]>>('/incidents/all');
    return response.data;
  },

  async getIncidents(projectId: number): Promise<IncidentDto[]> {
    const response = await apiClient.get<ApiResponse<IncidentDto[]>>(`/incidents/project/${projectId}`);
    return response.data;
  },

  async createAndAssessIncident(data: {
    projectId: number;
    taskId?: number;
    phaseId?: number;
    incidentType: string;
    description: string;
    damageDescription?: string;
    estimatedMaterialLoss?: number;
    estimatedLaborDays?: number;
    estimatedDelayDays?: number;
    proposedAction?: string;
    isEmergency?: boolean;
  }): Promise<ApiResult<IncidentDto>> {
    const response = await apiClient.post<ApiResponse<IncidentDto>>('/incidents', data);
    return { data: response.data, message: response.message || '' };
  },

  async confirmIncident(
    id: number,
    data: {
      incidentId: number;
      createReworkTask: boolean;
      reworkTaskName?: string;
      reworkTaskStartDate?: string;
      reworkTaskEndDate?: string;
      reworkAssigneeId?: number;
      reworkTaskDescription?: string;
      reworkTaskWeight?: number;
      isOutsourced?: boolean;
      outsourcedTeamName?: string;
      outsourcedTeamContact?: string;
      decreaseProgressTo?: number;
      decreaseProgressReason?: string;
      handlingInstruction?: string;
      recoveryPlanText?: string;
      recoveryEstimateCost?: number;
      decision?: string;
    }
  ): Promise<ApiResult<IncidentDto>> {
    const response = await apiClient.put<ApiResponse<IncidentDto>>(`/incidents/${id}/confirm`, data);
    return { data: response.data, message: response.message || '' };
  },

  async rejectIncident(id: number, reason: string): Promise<ApiResult<IncidentDto>> {
    const response = await apiClient.put<ApiResponse<IncidentDto>>(`/incidents/${id}/reject`, { incidentId: id, reason });
    return { data: response.data, message: response.message || '' };
  }
};
