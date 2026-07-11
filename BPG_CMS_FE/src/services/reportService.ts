import { apiClient } from './api';
import type { ApiResponse } from '../types/api';

// ============================================================
// Executive Dashboard
// ============================================================
export interface PhaseProgressSummaryDto {
  phaseId: number;
  phaseName: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
}

export interface DelayedTaskInfoDto {
  taskId: number;
  taskName: string;
  phaseName: string;
  progressPercent: number;
  endDate: string;
  assigneeName?: string;
  warningType: 'Red' | 'Yellow';
}

export interface ExecutiveDashboardDto {
  projectId: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  delayedTasks: number;
  atRiskTasks: number;
  materialsExceedingBOQ: number;
  overBoqMaterialRequests: number;
  phaseBreakdown: PhaseProgressSummaryDto[];
  delayedTasksList: DelayedTaskInfoDto[];
}

// ============================================================
// Gantt Chart
// ============================================================
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

// ============================================================
// BOQ vs Actual
// ============================================================
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
  usagePercent: number;
}

export interface BoqVsActualReportDto {
  projectId: number;
  items: BoqVsActualItemDto[];
}

// ============================================================
// Cost Reference (legacy)
// ============================================================
export interface CostReferenceReportDto {
  projectId: number;
  totalPoCost: number;
  totalDirectPurchaseCost: number;
  totalCost: number;
}

// ============================================================
// Construction Progress Report
// ============================================================
export interface TaskSummaryDto {
  taskId: number;
  taskName: string;
  status: string;
  progressPercent: number;
  endDate: string;
  assigneeName?: string;
  isDelayed: boolean;
}

export interface PhaseProgressDto {
  phaseId: number;
  phaseName: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
  startDate?: string;
  endDate?: string;
  delayedTasks: TaskSummaryDto[];
  allTasks: TaskSummaryDto[];
}

export interface PhaseAcceptanceSummaryDto {
  acceptanceId: number;
  phaseName: string;
  acceptanceDate: string;
  acceptorName: string;
  isCancelled: boolean;
  cancellationReason?: string;
}

export interface ConstructionProgressReportDto {
  projectId: number;
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  assignedTasks: number;
  newTasks: number;
  obsoleteTasks: number;
  overallProgressPercent: number;
  phases: PhaseProgressDto[];
  acceptances: PhaseAcceptanceSummaryDto[];
}

// ============================================================
// Incident Report
// ============================================================
export interface IncidentSummaryDto {
  incidentId: number;
  incidentType: string;
  description: string;
  status: string;
  reporterName: string;
  reviewerName?: string;
  taskName?: string;
  phaseName?: string;
  damageDescription?: string;
  estimatedMaterialLoss?: number;
  estimatedDelayDays?: number;
  hasReworkTask: boolean;
  reworkTaskName?: string;
  createdAt: string;
}

export interface IncidentReportDto {
  projectId: number;
  totalIncidents: number;
  openIncidents: number;
  resolvedIncidents: number;
  incidentsWithRework: number;
  incidents: IncidentSummaryDto[];
}

// ============================================================
// Inventory Ledger Report
// ============================================================
export interface CurrentInventorySummaryDto {
  materialId: number;
  materialCode: string;
  materialName: string;
  unitName: string;
  currentQuantity: number;
}

export interface InventoryTransactionSummaryDto {
  transactionId: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  unitName: string;
  referenceType: string;
  quantityChange: number;
  balanceAfter: number;
  createdByName?: string;
  createdAt: string;
}

export interface InventoryLedgerReportDto {
  projectId: number;
  totalMaterialTypes: number;
  zeroStockCount: number;
  currentStock: CurrentInventorySummaryDto[];
  transactions: InventoryTransactionSummaryDto[];
}

// ============================================================
// Procurement Report
// ============================================================
export interface PurchaseOrderSummaryDto {
  pOId: number;
  pONumber: string;
  status: string;
  supplierName?: string;
  totalAmount: number;
  orderDate: string;
  expectedDeliveryDate?: string;
}

export interface DirectPurchaseSummaryDto {
  directPurchaseId: number;
  requestedByName: string;
  status: string;
  totalAmount: number;
  invoiceImageUrl?: string;
  createdAt: string;
}

export interface ProcurementReportDto {
  projectId: number;
  totalPoCost: number;
  totalDirectPurchaseCost: number;
  totalCost: number;
  purchaseOrders: PurchaseOrderSummaryDto[];
  directPurchases: DirectPurchaseSummaryDto[];
}

// ============================================================
// Service Methods
// ============================================================
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
  },

  async getConstructionProgress(projectId: number): Promise<ConstructionProgressReportDto> {
    const response = await apiClient.get<ApiResponse<ConstructionProgressReportDto>>(`/reports/project/${projectId}/construction-progress`);
    return response.data;
  },

  async getIncidentReport(projectId: number): Promise<IncidentReportDto> {
    const response = await apiClient.get<ApiResponse<IncidentReportDto>>(`/reports/project/${projectId}/incidents`);
    return response.data;
  },

  async getInventoryLedger(projectId: number): Promise<InventoryLedgerReportDto> {
    const response = await apiClient.get<ApiResponse<InventoryLedgerReportDto>>(`/reports/project/${projectId}/inventory-ledger`);
    return response.data;
  },

  async getProcurementReport(projectId: number): Promise<ProcurementReportDto> {
    const response = await apiClient.get<ApiResponse<ProcurementReportDto>>(`/reports/project/${projectId}/procurement`);
    return response.data;
  },
};
