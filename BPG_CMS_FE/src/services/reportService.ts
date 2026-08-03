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

export interface PeriodComparisonMetricsDto {
  currentCompletedTasks: number;
  previousCompletedTasks: number;
  completedTasksDeltaPercent: number;
  currentIncidents: number;
  previousIncidents: number;
  incidentsDeltaPercent: number;
  currentProcurementCost: number;
  previousProcurementCost: number;
  procurementCostDeltaPercent: number;
  currentOverBoqMRs: number;
  previousOverBoqMRs: number;
}

export interface ProjectComparisonMatrixItemDto {
  projectId: number;
  projectName: string;
  status: string;
  progressPercent: number;
  totalTasks: number;
  delayedTasks: number;
  atRiskTasks: number;
  overBoqCount: number;
  totalIncidents: number;
  estimatedLossVnd: number;
  healthStatus: 'Green' | 'Yellow' | 'Red';
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
  periodComparison?: PeriodComparisonMetricsDto;
  crossProjectMatrix?: ProjectComparisonMatrixItemDto[];
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
  unitPrice: number;
  boqLimit: number;
  totalIssued: number;
  totalReturned: number;
  netConsumption: number;
  stockRemaining: number;
  pendingPoQuantity: number;
  pendingMrQuantity: number;
  totalExpectedUsage: number;
  isExceeding: boolean;
  exceededAmount: number;
  savedAmount?: number;
  usagePercent: number;
  boqTotalValue?: number;
  consumptionValue?: number;
  varianceValue?: number;
}

export interface BoqVsActualReportDto {
  projectId: number;
  totalBoqItemsCount?: number;
  exceedingItemsCount?: number;
  savingItemsCount?: number;
  normalItemsCount?: number;
  totalBoqValue?: number;
  totalConsumptionValue?: number;
  totalVarianceValue?: number;
  items: BoqVsActualItemDto[];
}

export interface ConsolidatedExecutiveReportDto {
  projectId: number;
  projectName: string;
  generatedAt: string;
  fromDate?: string;
  toDate?: string;
  executiveMetrics: ExecutiveDashboardDto;
  progressSummary: ConstructionProgressReportDto;
  boqSummary: BoqVsActualReportDto;
  incidentSummary: IncidentReportDto;
  procurementSummary: ProcurementReportDto;
  crossProjectMatrix: ProjectComparisonMatrixItemDto[];
  executiveInsights: string[];
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

export interface AssigneePerformanceDto {
  assigneeName: string;
  totalTasks: number;
  completedTasks: number;
  delayedTasks: number;
  onTimeRatePercent: number;
}

export interface PhaseProgressDto {
  phaseId: number;
  phaseName: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
  expectedProgressPercent?: number;
  scheduleVarianceDays?: number;
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
  expectedProgressPercent?: number;
  scheduleVariancePercent?: number;
  scheduleVarianceDays?: number;
  forecastedEndDate?: string;
  phases: PhaseProgressDto[];
  acceptances: PhaseAcceptanceSummaryDto[];
  assigneePerformance?: AssigneePerformanceDto[];
  progressInsights?: string[];
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
// Inventory Movement & Reconciliation Report
// ============================================================
export interface InventoryMovementItemDto {
  materialId: number;
  materialCode: string;
  materialName: string;
  unitName: string;
  openingBalance: number;
  totalReceived: number;
  totalIssued: number;
  totalReturned: number;
  totalTransferredIn: number;
  totalTransferredOut: number;
  totalAdjustments: number;
  closingBalance: number;
}

export interface InventoryMovementReportDto {
  projectId: number;
  fromDate?: string;
  toDate?: string;
  totalMaterials: number;
  items: InventoryMovementItemDto[];
}

export interface ReportFilterParams {
  [key: string]: string | number | boolean | undefined;
  fromDate?: string;
  toDate?: string;
}

// ============================================================
// Service Methods
// ============================================================
export const reportService = {
  async getExecutiveDashboard(projectId: number, params?: ReportFilterParams): Promise<ExecutiveDashboardDto> {
    const response = await apiClient.get<ApiResponse<ExecutiveDashboardDto>>(`/reports/project/${projectId}/executive-dashboard`, { params });
    return response.data;
  },

  async getBoqVsActual(projectId: number, params?: ReportFilterParams): Promise<BoqVsActualReportDto> {
    const response = await apiClient.get<ApiResponse<BoqVsActualReportDto>>(`/reports/project/${projectId}/boq-vs-actual`, { params });
    return response.data;
  },

  async getCostReference(projectId: number): Promise<CostReferenceReportDto> {
    const response = await apiClient.get<ApiResponse<ProcurementReportDto>>(`/reports/project/${projectId}/procurement`);
    const proc = response.data;
    return {
      projectId: proc.projectId,
      totalPoCost: proc.totalPoCost,
      totalDirectPurchaseCost: proc.totalDirectPurchaseCost,
      totalCost: proc.totalCost
    };
  },

  async getConstructionProgress(projectId: number, params?: ReportFilterParams): Promise<ConstructionProgressReportDto> {
    const response = await apiClient.get<ApiResponse<ConstructionProgressReportDto>>(`/reports/project/${projectId}/construction-progress`, { params });
    return response.data;
  },

  async getIncidentReport(projectId: number, params?: ReportFilterParams): Promise<IncidentReportDto> {
    const response = await apiClient.get<ApiResponse<IncidentReportDto>>(`/reports/project/${projectId}/incidents`, { params });
    return response.data;
  },

  async getInventoryMovement(projectId: number, params?: ReportFilterParams): Promise<InventoryMovementReportDto> {
    const response = await apiClient.get<ApiResponse<InventoryMovementReportDto>>(`/reports/project/${projectId}/inventory-movement`, { params });
    return response.data;
  },

  async getInventoryLedger(projectId: number): Promise<InventoryLedgerReportDto> {
    const response = await apiClient.get<ApiResponse<InventoryLedgerReportDto>>(`/reports/project/${projectId}/inventory-ledger`);
    return response.data;
  },

  async getProcurementReport(projectId: number, params?: ReportFilterParams): Promise<ProcurementReportDto> {
    const response = await apiClient.get<ApiResponse<ProcurementReportDto>>(`/reports/project/${projectId}/procurement`, { params });
    return response.data;
  },

  async getConsolidatedExecutiveReport(projectId: number, params?: ReportFilterParams): Promise<ConsolidatedExecutiveReportDto> {
    const response = await apiClient.get<ApiResponse<ConsolidatedExecutiveReportDto>>(`/reports/project/${projectId}/consolidated-executive`, { params });
    return response.data;
  },
};
