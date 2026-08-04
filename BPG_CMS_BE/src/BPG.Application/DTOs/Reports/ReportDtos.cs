namespace BPG.Application.DTOs.Reports;

// ============================================================
// Executive Dashboard
// ============================================================

public record ExecutiveDashboardDto
{
    public long ProjectId { get; init; }
    public int TotalTasks { get; init; }
    public int CompletedTasks { get; init; }
    public int InProgressTasks { get; init; }
    public int DelayedTasks { get; init; }      // Red warnings
    public int AtRiskTasks { get; init; }       // Yellow warnings
    public int MaterialsExceedingBOQ { get; init; }
    public int OverBoqMaterialRequests { get; init; }
    public List<PhaseProgressSummaryDto> PhaseBreakdown { get; init; } = new();
    public List<DelayedTaskInfoDto> DelayedTasksList { get; init; } = new();
    public PeriodComparisonMetricsDto? PeriodComparison { get; init; }
    public List<ProjectComparisonMatrixItemDto> CrossProjectMatrix { get; init; } = new();
    public List<MonthlyProgressTrendDto> MonthlyProgressTrends { get; init; } = new();
    public List<MonthlyProcurementTrendDto> MonthlyProcurementTrends { get; init; } = new();
}

public record PhaseProgressSummaryDto
{
    public long PhaseId { get; init; }
    public string PhaseName { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public int TotalTasks { get; init; }
    public int CompletedTasks { get; init; }
    public decimal ProgressPercent { get; init; }
}

public record DelayedTaskInfoDto
{
    public long TaskId { get; init; }
    public string TaskName { get; init; } = string.Empty;
    public string PhaseName { get; init; } = string.Empty;
    public int ProgressPercent { get; init; }
    public DateOnly EndDate { get; init; }
    public string? AssigneeName { get; init; }
    public string WarningType { get; init; } = string.Empty; // "Red" | "Yellow"
}

// ============================================================
// Gantt Chart
// ============================================================

public record GanttChartDataDto
{
    public List<GanttPhaseDto> Phases { get; init; } = new();
}

public record GanttPhaseDto
{
    public long PhaseId { get; init; }
    public string PhaseName { get; init; } = string.Empty;
    public DateTime BaselineStart { get; init; }
    public DateTime BaselineEnd { get; init; }
    public string Status { get; init; } = string.Empty;
    public List<GanttTaskDto> Tasks { get; init; } = new();
}

public record GanttTaskDto
{
    public long TaskId { get; init; }
    public string TaskName { get; init; } = string.Empty;
    public DateTime BaselineStart { get; init; }
    public DateTime BaselineEnd { get; init; }
    public int Progress { get; init; }
    public string Status { get; init; } = string.Empty;
    public bool IsDelayed { get; init; }
}

// ============================================================
// BOQ vs Actual
// ============================================================

public record BoqVsActualReportDto
{
    public long ProjectId { get; init; }
    public decimal OverallProgressPercent { get; init; }
    public int TotalBoqItemsCount { get; init; }
    public int ExceedingItemsCount { get; init; }
    public int EarnedExceedingItemsCount { get; init; }
    public int SavingItemsCount { get; init; }
    public int NormalItemsCount { get; init; }
    public decimal TotalBoqValue { get; init; }
    public decimal TotalConsumptionValue { get; init; }
    public decimal TotalVarianceValue { get; init; } // Total Exceeded Value - Total Saved Value
    public List<BoqVsActualItemDto> Items { get; init; } = new();
    public List<MonthlyBoqConsumptionTrendDto> MonthlyTrends { get; init; } = new();
}

public record BoqVsActualItemDto
{
    public long MaterialId { get; init; }
    public string MaterialCode { get; init; } = string.Empty;
    public string MaterialName { get; init; } = string.Empty;
    public string UnitName { get; init; } = string.Empty;
    public decimal UnitPrice { get; init; }
    public decimal OriginalBoqUnitPrice { get; init; }
    public decimal BoqLimit { get; init; }
    public decimal OverallProgressPercent { get; init; }
    public decimal EarnedBoqLimit => Math.Round(BoqLimit * (OverallProgressPercent / 100m), 2);
    public decimal TotalIssued { get; init; }
    public decimal TotalReturned { get; init; }
    public decimal NetConsumption => Math.Max(0, TotalIssued - TotalReturned);
    public decimal StockRemaining { get; init; }
    public decimal PendingPoQuantity { get; init; }
    public decimal PendingMrQuantity { get; init; }
    public decimal TotalExpectedUsage => NetConsumption + StockRemaining;
    public bool IsExceeding => NetConsumption > BoqLimit;
    public bool IsEarnedExceeding => NetConsumption > EarnedBoqLimit && EarnedBoqLimit > 0;
    public decimal ExceededAmount => IsExceeding ? NetConsumption - BoqLimit : 0;
    public decimal EarnedExceededAmount => IsEarnedExceeding ? NetConsumption - EarnedBoqLimit : 0;
    public decimal SavedAmount => NetConsumption < BoqLimit ? BoqLimit - NetConsumption : 0;
    public decimal UsagePercent => BoqLimit > 0 ? Math.Round(NetConsumption / BoqLimit * 100, 1) : 0;
    public decimal EarnedUsagePercent => EarnedBoqLimit > 0 ? Math.Round(NetConsumption / EarnedBoqLimit * 100, 1) : 0;
    public decimal BoqTotalValue => BoqLimit * (OriginalBoqUnitPrice > 0 ? OriginalBoqUnitPrice : UnitPrice);
    public decimal ConsumptionValue => NetConsumption * UnitPrice;
    public decimal VarianceValue => (NetConsumption - BoqLimit) * UnitPrice;
}

// ============================================================
// Inventory Movement & Reconciliation Report
// ============================================================

public record InventoryMovementReportDto
{
    public long ProjectId { get; init; }
    public DateTime? FromDate { get; init; }
    public DateTime? ToDate { get; init; }
    public int TotalMaterials { get; init; }
    public List<InventoryMovementItemDto> Items { get; init; } = new();
}

public record InventoryMovementItemDto
{
    public long MaterialId { get; init; }
    public string MaterialCode { get; init; } = string.Empty;
    public string MaterialName { get; init; } = string.Empty;
    public string UnitName { get; init; } = string.Empty;
    public decimal OpeningBalance { get; init; }
    public decimal TotalReceived { get; init; }
    public decimal TotalIssued { get; init; }
    public decimal TotalReturned { get; init; }
    public decimal TotalTransferredIn { get; init; }
    public decimal TotalTransferredOut { get; init; }
    public decimal TotalAdjustments { get; init; }
    public decimal ClosingBalance { get; init; }
}

// ============================================================
// Cost Reference (legacy - kept for backward compatibility)
// ============================================================

public record CostReferenceReportDto
{
    public long ProjectId { get; init; }
    public decimal TotalPoCost { get; init; }
    public decimal TotalDirectPurchaseCost { get; init; }
    public decimal TotalCost => TotalPoCost + TotalDirectPurchaseCost;
}

// ============================================================
// Construction Progress Report
// ============================================================

public record AssigneePerformanceDto
{
    public string AssigneeName { get; init; } = string.Empty;
    public int TotalTasks { get; init; }
    public int CompletedTasks { get; init; }
    public int DelayedTasks { get; init; }
    public decimal OnTimeRatePercent { get; init; }
}

public record ConstructionProgressReportDto
{
    public long ProjectId { get; init; }
    public int TotalTasks { get; init; }
    public int DoneTasks { get; init; }
    public int InProgressTasks { get; init; }
    public int AssignedTasks { get; init; }
    public int NewTasks { get; init; }
    public int ObsoleteTasks { get; init; }
    public decimal OverallProgressPercent { get; init; }
    public decimal ExpectedProgressPercent { get; init; }
    public decimal ScheduleVariancePercent => OverallProgressPercent - ExpectedProgressPercent;
    public int ScheduleVarianceDays { get; init; }

    /// <summary>
    /// Ngưỡng cảnh báo trễ tiến độ (%) lấy từ SystemConfigs (ExpectedDelayPercent).
    /// Chậm hơn kế hoạch nhưng còn trong ngưỡng này thì chỉ cảnh báo vàng; vượt ngưỡng mới báo đỏ.
    /// </summary>
    public decimal DelayWarningThresholdPercent { get; init; }
    public string? ForecastedEndDate { get; init; }
    public List<PhaseProgressDto> Phases { get; init; } = new();
    public List<PhaseAcceptanceSummaryDto> Acceptances { get; init; } = new();
    public List<AssigneePerformanceDto> AssigneePerformance { get; init; } = new();
    public List<string> ProgressInsights { get; init; } = new();
    public List<MonthlyProgressTrendDto> MonthlyTrends { get; init; } = new();
}

public record PhaseProgressDto
{
    public long PhaseId { get; init; }
    public string PhaseName { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public int TotalTasks { get; init; }
    public int CompletedTasks { get; init; }
    public decimal ProgressPercent { get; init; }
    public decimal ExpectedProgressPercent { get; init; }
    public int ScheduleVarianceDays { get; init; }
    public DateOnly? StartDate { get; init; }
    public DateOnly? EndDate { get; init; }
    public List<TaskSummaryDto> DelayedTasks { get; init; } = new();
    public List<TaskSummaryDto> AllTasks { get; init; } = new();
}

public record TaskSummaryDto
{
    public long TaskId { get; init; }
    public string TaskName { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public int ProgressPercent { get; init; }
    public DateOnly EndDate { get; init; }
    public string? AssigneeName { get; init; }
    public bool IsDelayed { get; init; }
}

public record PhaseAcceptanceSummaryDto
{
    public long AcceptanceId { get; init; }
    public string PhaseName { get; init; } = string.Empty;
    public DateTime AcceptanceDate { get; init; }
    public string AcceptorName { get; init; } = string.Empty;
    public bool IsCancelled { get; init; }
    public string? CancellationReason { get; init; }
}

// ============================================================
// Incident Report
// ============================================================

public record IncidentReportDto
{
    public long ProjectId { get; init; }
    public int TotalIncidents { get; init; }
    public int OpenIncidents { get; init; }
    public int ResolvedIncidents { get; init; }
    public int IncidentsWithRework { get; init; }
    public List<IncidentSummaryDto> Incidents { get; init; } = new();
    public List<MonthlyIncidentTrendDto> MonthlyTrends { get; init; } = new();
}

public record IncidentSummaryDto
{
    public long IncidentId { get; init; }
    public string IncidentType { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string ReporterName { get; init; } = string.Empty;
    public string? ReviewerName { get; init; }
    public string? TaskName { get; init; }
    public string? PhaseName { get; init; }
    public string? DamageDescription { get; init; }
    public decimal? EstimatedMaterialLoss { get; init; }
    public int? EstimatedDelayDays { get; init; }
    public bool HasReworkTask { get; init; }
    public string? ReworkTaskName { get; init; }
    public DateTime CreatedAt { get; init; }
}

// ============================================================
// Inventory Ledger Report
// ============================================================

public record InventoryLedgerReportDto
{
    public long ProjectId { get; init; }
    public int TotalMaterialTypes { get; init; }
    public int ZeroStockCount { get; init; }
    public List<CurrentInventorySummaryDto> CurrentStock { get; init; } = new();
    public List<InventoryTransactionSummaryDto> Transactions { get; init; } = new();
}

public record CurrentInventorySummaryDto
{
    public long MaterialId { get; init; }
    public string MaterialCode { get; init; } = string.Empty;
    public string MaterialName { get; init; } = string.Empty;
    public string UnitName { get; init; } = string.Empty;
    public decimal CurrentQuantity { get; init; }
}

public record InventoryTransactionSummaryDto
{
    public long TransactionId { get; init; }
    public long MaterialId { get; init; }
    public string MaterialCode { get; init; } = string.Empty;
    public string MaterialName { get; init; } = string.Empty;
    public string UnitName { get; init; } = string.Empty;
    public string ReferenceType { get; init; } = string.Empty;
    public decimal QuantityChange { get; init; }
    public decimal BalanceAfter { get; init; }
    public string? CreatedByName { get; init; }
    public DateTime CreatedAt { get; init; }
}

// ============================================================
// Procurement Report
// ============================================================

public record ProcurementReportDto
{
    public long ProjectId { get; init; }
    public decimal TotalPoCost { get; init; }
    public decimal TotalDirectPurchaseCost { get; init; }
    public decimal TotalMaterialIssuanceValue { get; init; }
    public decimal TotalProcurementSavings { get; init; }
    public decimal TotalCost => TotalPoCost + TotalDirectPurchaseCost;
    public List<PurchaseOrderSummaryDto> PurchaseOrders { get; init; } = new();
    public List<DirectPurchaseSummaryDto> DirectPurchases { get; init; } = new();
    public List<MonthlyProcurementTrendDto> MonthlyTrends { get; init; } = new();
}

// ============================================================
// Monthly Trend DTO Definitions
// ============================================================

public record MonthlyProgressTrendDto
{
    public int Year { get; init; }
    public int Month { get; init; }
    public string MonthLabel { get; init; } = string.Empty; // e.g. "T05/2026"
    public int CompletedTasksCount { get; init; }
    public decimal AccumulatedProgressPercent { get; init; } // Actual S-Curve %
    public decimal PlannedProgressPercent { get; init; }     // Planned Baseline S-Curve %
    public decimal ActualProgressPercent { get; init; }      // Actual S-Curve %
    public decimal PlannedMonthlyVolume { get; init; }       // Planned Work Volume % in Month
    public decimal ActualMonthlyVolume { get; init; }        // Actual Work Volume % in Month
    public bool IsFuture { get; init; }
}

public record MonthlyProcurementTrendDto
{
    public int Year { get; init; }
    public int Month { get; init; }
    public string MonthLabel { get; init; } = string.Empty;
    public decimal PoCostVnd { get; init; }
    public decimal DirectPurchaseCostVnd { get; init; }
    public decimal TotalCostVnd => PoCostVnd + DirectPurchaseCostVnd;
    public int PoCount { get; init; }
}

public record MonthlyIncidentTrendDto
{
    public int Year { get; init; }
    public int Month { get; init; }
    public string MonthLabel { get; init; } = string.Empty;
    public int TotalIncidentsCount { get; init; }
    public int ResolvedIncidentsCount { get; init; }
    public decimal EstimatedLossVnd { get; init; }
}

public record MonthlyBoqConsumptionTrendDto
{
    public int Year { get; init; }
    public int Month { get; init; }
    public string MonthLabel { get; init; } = string.Empty;
    public int MaterialRequestCount { get; init; }
    public decimal ConsumedValueVnd { get; init; }
}

public record PurchaseOrderSummaryDto
{
    public long POId { get; init; }
    public string PONumber { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string? SupplierName { get; init; }
    public decimal TotalAmount { get; init; }
    public DateTime OrderDate { get; init; }
    public DateOnly? ExpectedDeliveryDate { get; init; }
}

public record DirectPurchaseSummaryDto
{
    public long DirectPurchaseId { get; init; }
    public string RequestedByName { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public decimal TotalAmount { get; init; }
    public string? InvoiceImageUrl { get; init; }
    public DateTime CreatedAt { get; init; }
}

// ============================================================
// Consolidated & Comparative Analytical Reports
// ============================================================

public record PeriodComparisonMetricsDto
{
    public int CurrentCompletedTasks { get; init; }
    public int PreviousCompletedTasks { get; init; }
    public decimal CompletedTasksDeltaPercent { get; init; }

    public int CurrentIncidents { get; init; }
    public int PreviousIncidents { get; init; }
    public decimal IncidentsDeltaPercent { get; init; }

    public decimal CurrentProcurementCost { get; init; }
    public decimal PreviousProcurementCost { get; init; }
    public decimal ProcurementCostDeltaPercent { get; init; }

    public int CurrentOverBoqMRs { get; init; }
    public int PreviousOverBoqMRs { get; init; }
}

public record ProjectComparisonMatrixItemDto
{
    public long ProjectId { get; init; }
    public string ProjectName { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public decimal ProgressPercent { get; init; }
    public int TotalTasks { get; init; }
    public int DelayedTasks { get; init; }
    public int AtRiskTasks { get; init; }
    public int OverBoqCount { get; init; }
    public int TotalIncidents { get; init; }
    public decimal EstimatedLossVnd { get; init; }
    public string HealthStatus { get; init; } = "Green"; // "Green" | "Yellow" | "Red"
}

public record ConsolidatedExecutiveReportDto
{
    public long ProjectId { get; init; }
    public string ProjectName { get; init; } = string.Empty;
    public DateTime GeneratedAt { get; init; } = DateTime.UtcNow;
    public DateTime? FromDate { get; init; }
    public DateTime? ToDate { get; init; }
    public ExecutiveDashboardDto ExecutiveMetrics { get; init; } = new();
    public ConstructionProgressReportDto ProgressSummary { get; init; } = new();
    public BoqVsActualReportDto BoqSummary { get; init; } = new();
    public IncidentReportDto IncidentSummary { get; init; } = new();
    public ProcurementReportDto ProcurementSummary { get; init; } = new();
    public List<ProjectComparisonMatrixItemDto> CrossProjectMatrix { get; init; } = new();
    public List<string> ExecutiveInsights { get; init; } = new();
}

