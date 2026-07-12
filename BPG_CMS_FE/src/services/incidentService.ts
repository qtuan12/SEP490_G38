import { apiClient } from './api';
import type { ApiResponse } from '../types/api';

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
  damageDescription?: string;
  estimatedMaterialLoss?: number;
  estimatedLaborDays?: number;
  estimatedDelayDays?: number;
  proposedAction?: string;
  handlingInstruction?: string;
  reworkTaskId?: number;
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
  }): Promise<IncidentDto> {
    const response = await apiClient.post<ApiResponse<IncidentDto>>('/incidents', data);
    return response.data;
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
      decreaseProgressTo?: number;
      decreaseProgressReason?: string;
      handlingInstruction?: string;
    }
  ): Promise<IncidentDto> {
    const response = await apiClient.put<ApiResponse<IncidentDto>>(`/incidents/${id}/confirm`, data);
    return response.data;
  },

  async rejectIncident(id: number, reason: string): Promise<IncidentDto> {
    const response = await apiClient.put<ApiResponse<IncidentDto>>(`/incidents/${id}/reject`, { incidentId: id, reason });
    return response.data;
  }
};
