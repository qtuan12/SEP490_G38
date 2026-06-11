namespace BPG.Domain.Entities;

public class Incident : BaseEntity
{
    public long IncidentId { get; set; }
    public long ProjectId { get; set; }
    public long? TaskId { get; set; }
    public long ReportedBy { get; set; }
    public long? ReviewedBy { get; set; }
    public string IncidentType { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "Reported";
    public string? DamageDescription { get; set; }
    public decimal? EstimatedMaterialLoss { get; set; }
    public decimal? EstimatedLaborDays { get; set; }
    public int? EstimatedDelayDays { get; set; }
    public string? ProposedAction { get; set; }
    public long? ReworkTaskId { get; set; }

    public Project Project { get; set; } = null!;
    public ProjectTask? Task { get; set; }
    public User Reporter { get; set; } = null!;
    public User? Reviewer { get; set; }
    public ProjectTask? ReworkTask { get; set; }
}
