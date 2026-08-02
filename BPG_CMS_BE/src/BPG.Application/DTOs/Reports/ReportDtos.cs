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
    public List<BoqVsActualItemDto> Items { get; init; } = new();
}

public record BoqVsActualItemDto
{
    public long MaterialId { get; init; }
    public string MaterialCode { get; init; } = string.Empty;
    public string MaterialName { get; init; } = string.Empty;
    public string UnitName { get; init; } = string.Empty;
    public decimal BoqLimit { get; init; }
    public decimal TotalIssued { get; init; }
    public decimal TotalReturned { get; init; }
    public decimal NetConsumption => Math.Max(0, TotalIssued - TotalReturned);
    public decimal StockRemaining { get; init; }
    public decimal PendingPoQuantity { get; init; }
    public decimal PendingMrQuantity { get; init; }
    public decimal TotalExpectedUsage => NetConsumption + StockRemaining;
    public bool IsExceeding => NetConsumption > BoqLimit;
    public decimal ExceededAmount => IsExceeding ? NetConsumption - BoqLimit : 0;
    public decimal UsagePercent => BoqLimit > 0 ? Math.Round(NetConsumption / BoqLimit * 100, 1) : 0;
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
    public List<PhaseProgressDto> Phases { get; init; } = new();
    public List<PhaseAcceptanceSummaryDto> Acceptances { get; init; } = new();
}

public record PhaseProgressDto
{
    public long PhaseId { get; init; }
    public string PhaseName { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public int TotalTasks { get; init; }
    public int CompletedTasks { get; init; }
    public decimal ProgressPercent { get; init; }
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
    public decimal TotalCost => TotalPoCost + TotalDirectPurchaseCost;
    public List<PurchaseOrderSummaryDto> PurchaseOrders { get; init; } = new();
    public List<DirectPurchaseSummaryDto> DirectPurchases { get; init; } = new();
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
