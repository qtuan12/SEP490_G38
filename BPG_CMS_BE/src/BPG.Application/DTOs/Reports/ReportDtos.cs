namespace BPG.Application.DTOs.Reports;

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
}

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
    public decimal StockRemaining { get; init; }
    public decimal PendingPoQuantity { get; init; }
    public decimal PendingMrQuantity { get; init; }
    public decimal TotalExpectedUsage => TotalIssued + StockRemaining + PendingPoQuantity + PendingMrQuantity;
    public bool IsExceeding => TotalExpectedUsage > BoqLimit;
    public decimal ExceededAmount => IsExceeding ? TotalExpectedUsage - BoqLimit : 0;
}

public record CostReferenceReportDto
{
    public long ProjectId { get; init; }
    public decimal TotalPoCost { get; init; }
    public decimal TotalDirectPurchaseCost { get; init; }
    public decimal TotalCost => TotalPoCost + TotalDirectPurchaseCost;
}
