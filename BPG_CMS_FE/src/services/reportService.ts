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
  monthlyProgressTrends?: MonthlyProgressTrendDto[];
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
  originalBoqUnitPrice?: number;
  boqLimit: number;
  overallProgressPercent?: number;
  earnedBoqLimit?: number;
  totalIssued: number;
  totalReturned: number;
  netConsumption: number;
  stockRemaining: number;
  pendingPoQuantity: number;
  pendingMrQuantity: number;
  totalExpectedUsage: number;
  isExceeding: boolean;
  isEarnedExceeding?: boolean;
  exceededAmount: number;
  earnedExceededAmount?: number;
  savedAmount?: number;
  usagePercent: number;
  earnedUsagePercent?: number;
  boqTotalValue?: number;
  consumptionValue?: number;
  varianceValue?: number;
}

export interface BoqVsActualReportDto {
  projectId: number;
  overallProgressPercent?: number;
  totalBoqItemsCount?: number;
  exceedingItemsCount?: number;
  earnedExceedingItemsCount?: number;
  savingItemsCount?: number;
  normalItemsCount?: number;
  totalBoqValue?: number;
  totalConsumptionValue?: number;
  totalVarianceValue?: number;
  items: BoqVsActualItemDto[];
  monthlyTrends?: MonthlyBoqConsumptionTrendDto[];
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
  /** Ngưỡng cảnh báo trễ tiến độ (%) lấy từ cấu hình hệ thống ExpectedDelayPercent. */
  delayWarningThresholdPercent?: number;
  forecastedEndDate?: string;
  phases: PhaseProgressDto[];
  acceptances: PhaseAcceptanceSummaryDto[];
  assigneePerformance?: AssigneePerformanceDto[];
  progressInsights?: string[];
  monthlyTrends?: MonthlyProgressTrendDto[];
}

// ============================================================
// Monthly Trend Interfaces
// ============================================================

export interface MonthlyProgressTrendDto {
  year: number;
  month: number;
  monthLabel: string;
  completedTasksCount: number;
  accumulatedProgressPercent: number;
}

export interface MonthlyProcurementTrendDto {
  year: number;
  month: number;
  monthLabel: string;
  poCostVnd: number;
  directPurchaseCostVnd: number;
  totalCostVnd: number;
  poCount: number;
}

export interface MonthlyIncidentTrendDto {
  year: number;
  month: number;
  monthLabel: string;
  totalIncidentsCount: number;
  resolvedIncidentsCount: number;
  estimatedLossVnd: number;
}

export interface MonthlyBoqConsumptionTrendDto {
  year: number;
  month: number;
  monthLabel: string;
  materialRequestCount: number;
  consumedValueVnd: number;
}

// ============================================================
// Incident Report
// ============================================================
export interface IncidentSummaryDto {
  incidentId: number;
  projectId?: number;
  incidentType: string;
  description: string;
  status: string;
  reporterName: string;
  reviewerName?: string;
  taskId?: number;
  taskName?: string;
  phaseName?: string;
  damageDescription?: string;
  estimatedMaterialLoss?: number;
  estimatedDelayDays?: number;
  hasReworkTask: boolean;
  reworkTaskId?: number;
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
  monthlyTrends?: MonthlyIncidentTrendDto[];
}

// ============================================================
// Procurement Report
// ============================================================
export interface PurchaseOrderSummaryDto {
  poId: number;
  poNumber: string;
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
  totalMaterialIssuanceValue?: number;
  totalProcurementSavings?: number;
  totalCost: number;
  purchaseOrders: PurchaseOrderSummaryDto[];
  directPurchases: DirectPurchaseSummaryDto[];
  monthlyTrends?: MonthlyProcurementTrendDto[];
}

// ============================================================
// Material Returns & Surplus Handling Report
// ============================================================
export interface SurplusMethodBreakdownDto {
  returnSupplierActionsCount?: number;
  transferActionsCount?: number;
  liquidationActionsCount?: number;
  pendingRemainingItemsCount?: number;
  returnSupplierQuantity: number;
  transferQuantity: number;
  liquidationQuantity: number;
  pendingRemainingQuantity: number;
  returnSupplierValueVnd: number;
  liquidationValueVnd: number;
}

export interface ReturnAndSurplusMonthlyTrendDto {
  year: number;
  month: number;
  monthLabel: string;
  returnSlipCount: number;
  returnQuantity: number;
  returnEstimatedValueVnd: number;
  surplusProcessedQuantity: number;
  financialRecoveryAmountVnd: number;
}

export interface TopReturnedMaterialDto {
  materialId: number;
  materialCode: string;
  materialName: string;
  unitName: string;
  totalQuantity: number;
  estimatedValueVnd: number;
  returnCount: number;
}

export interface ProjectSurplusComparisonDto {
  projectId: number;
  projectName: string;
  returnSlipCount: number;
  returnEstimatedValueVnd: number;
  surplusItemCount: number;
  surplusResolvedItemCount?: number;
  surplusTotalQuantity: number;
  surplusProcessedQuantity: number;
  surplusResolutionRatePercent: number;
  financialRecoveryAmountVnd: number;
}

export interface MaterialReturnItemDetailDto {
  returnItemId: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  estimatedValueVnd: number;
}

export interface MaterialReturnReportItemDto {
  materialReturnId: number;
  returnNo: string;
  projectId: number;
  projectName: string;
  originalIssuanceId: number;
  originalIssuanceNo: string;
  taskId: number;
  taskName: string;
  reason: string;
  returnDate: string;
  createdByName: string;
  totalItems: number;
  totalEstimatedValueVnd: number;
  items: MaterialReturnItemDetailDto[];
}

export interface SurplusRequestReportItemDto {
  surplusRequestId: number;
  surplusRequestItemId: number;
  projectId: number;
  projectName: string;
  materialId: number;
  materialCode: string;
  materialName: string;
  unitName: string;
  surplusQuantity: number;
  processedQuantity: number;
  remainingQuantity: number;
  resolutionPercent: number;
  status: string;
  reason?: string;
  createdAt: string;
  createdByName: string;
}

export interface SurplusActionDetailDto {
  actionType: 'ReturnSupplier' | 'Transfer' | 'Liquidation' | string;
  actionId: number;
  surplusRequestItemId: number;
  projectId: number;
  projectName: string;
  materialCode: string;
  materialName: string;
  unitName: string;
  quantity: number;
  financialValueVnd?: number;
  partnerOrDestination: string;
  status: string;
  actionDate: string;
  note?: string;
}

export interface MaterialReturnsAndSurplusReportDto {
  projectId: number;
  projectName: string;
  generatedAt: string;
  fromDate?: string;
  toDate?: string;

  totalReturnSlips: number;
  totalReturnItemsCount: number;
  totalReturnDistinctMaterialsCount?: number;
  totalReturnVolume: number;
  totalReturnEstimatedValue: number;

  totalSurplusBatches: number;
  totalSurplusItems: number;
  totalSurplusDistinctMaterialsCount?: number;
  totalSurplusResolvedItemsCount?: number;
  totalSurplusPendingItemsCount?: number;
  totalSurplusQuantity: number;
  totalSurplusProcessedQuantity: number;
  totalSurplusRemainingQuantity: number;
  surplusResolutionRatePercent: number;

  totalFinancialRecoveryAmount: number;
  totalSupplierRefundAmount: number;
  totalLiquidationAmount: number;
  totalTransferredQuantity: number;
  totalTransferredActionsCount: number;
  totalTransferredItemsCount?: number;
  totalTransferredMaterialsCount?: number;

  surplusMethodBreakdown: SurplusMethodBreakdownDto;
  monthlyTrends: ReturnAndSurplusMonthlyTrendDto[];
  topReturnedMaterials: TopReturnedMaterialDto[];
  crossProjectMatrix: ProjectSurplusComparisonDto[];

  materialReturns: MaterialReturnReportItemDto[];
  surplusRequests: SurplusRequestReportItemDto[];
  surplusActions: SurplusActionDetailDto[];
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

  async getProcurementReport(projectId: number, params?: ReportFilterParams): Promise<ProcurementReportDto> {
    const response = await apiClient.get<ApiResponse<ProcurementReportDto>>(`/reports/project/${projectId}/procurement`, { params });
    return response.data;
  },

  async getConsolidatedExecutiveReport(projectId: number, params?: ReportFilterParams): Promise<ConsolidatedExecutiveReportDto> {
    const response = await apiClient.get<ApiResponse<ConsolidatedExecutiveReportDto>>(`/reports/project/${projectId}/consolidated-executive`, { params });
    return response.data;
  },

  async getReturnsAndSurplusReport(projectId: number | string, params?: ReportFilterParams): Promise<MaterialReturnsAndSurplusReportDto> {
    const numericId = projectId === 'all' ? 0 : Number(projectId);
    const response = await apiClient.get<ApiResponse<MaterialReturnsAndSurplusReportDto>>(`/reports/project/${numericId}/returns-and-surplus`, { params });
    return response.data;
  },
};
