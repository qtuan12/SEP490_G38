import { apiClient } from './api';
import type { ApiResponse } from '../types/api';

export interface ExecutiveDashboardDto {
  projectId: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  delayedTasks: number;
  atRiskTasks: number;
  materialsExceedingBOQ: number;
  overBoqMaterialRequests: number;
}

export interface GanttTaskDto {
  taskId: number;
  taskName: string;
  baselineStart: string;
  baselineEnd: string;
  progress: number;
  status: string;
  isDelayed: boolean;
}

export interface GanttPhaseDto {
  phaseId: number;
  phaseName: string;
  baselineStart: string;
  baselineEnd: string;
  status: string;
  tasks: GanttTaskDto[];
}

export interface GanttChartDataDto {
  phases: GanttPhaseDto[];
}

export interface BoqVsActualItemDto {
  materialId: number;
  materialCode: string;
  materialName: string;
  unitName: string;
  boqLimit: number;
  totalIssued: number;
  stockRemaining: number;
  pendingPoQuantity: number;
  pendingMrQuantity: number;
  totalExpectedUsage: number;
  isExceeding: boolean;
  exceededAmount: number;
}

export interface BoqVsActualReportDto {
  projectId: number;
  items: BoqVsActualItemDto[];
}

export interface CostReferenceReportDto {
  projectId: number;
  totalPoCost: number;
  totalDirectPurchaseCost: number;
  totalCost: number;
}

export const reportService = {
  async getExecutiveDashboard(projectId: number): Promise<ExecutiveDashboardDto> {
    const response = await apiClient.get<ApiResponse<ExecutiveDashboardDto>>(`/reports/project/${projectId}/executive-dashboard`);
    return response.data;
  },

  async getGanttChart(projectId: number): Promise<GanttChartDataDto> {
    const response = await apiClient.get<ApiResponse<GanttChartDataDto>>(`/reports/project/${projectId}/gantt-chart`);
    return response.data;
  },

  async getBoqVsActual(projectId: number): Promise<BoqVsActualReportDto> {
    const response = await apiClient.get<ApiResponse<BoqVsActualReportDto>>(`/reports/project/${projectId}/boq-vs-actual`);
    return response.data;
  },

  async getCostReference(projectId: number): Promise<CostReferenceReportDto> {
    const response = await apiClient.get<ApiResponse<CostReferenceReportDto>>(`/reports/project/${projectId}/cost-reference`);
    return response.data;
  }
};
