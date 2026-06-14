namespace BPG.Application.Features.Projects.DTOs;

public class ProjectDto
{
    public long ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public DateOnly PlannedStart { get; set; }
    public DateOnly PlannedEnd { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? PauseReason { get; set; }
    public DateTime? PausedAt { get; set; }
    public DateTime? ResumedAt { get; set; }
}
