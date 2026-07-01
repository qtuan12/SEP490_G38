namespace BPG.Application.DTOs.Incidents;

public record IncidentDto
{
    public long IncidentId { get; init; }
    public long ProjectId { get; init; }
    public string ProjectName { get; init; } = string.Empty;
    public long? TaskId { get; init; }
    public string? TaskName { get; init; }
    public long ReportedBy { get; init; }
    public string ReporterName { get; init; } = string.Empty;
    public long? ReviewedBy { get; init; }
    public string? ReviewerName { get; init; }
    public string IncidentType { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string? DamageDescription { get; init; }
    public decimal? EstimatedMaterialLoss { get; init; }
    public decimal? EstimatedLaborDays { get; init; }
    public int? EstimatedDelayDays { get; init; }
    public string? ProposedAction { get; init; }
    public long? ReworkTaskId { get; init; }
    public string? HandlingInstruction { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }
}
