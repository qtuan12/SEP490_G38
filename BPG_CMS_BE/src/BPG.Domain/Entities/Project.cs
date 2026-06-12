namespace BPG.Domain.Entities;

public class Project : BaseEntity
{
    public long ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public DateOnly PlannedStart { get; set; }
    public DateOnly PlannedEnd { get; set; }
    public string Status { get; set; } = "Planning";
    public string? PauseReason { get; set; }
    public DateTime? PausedAt { get; set; }
    public DateTime? ResumedAt { get; set; }

    public ICollection<ProjectMember> Members { get; set; } = new List<ProjectMember>();
    public ICollection<Phase> Phases { get; set; } = new List<Phase>();
}
