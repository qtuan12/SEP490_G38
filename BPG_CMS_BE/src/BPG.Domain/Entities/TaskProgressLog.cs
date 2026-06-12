namespace BPG.Domain.Entities;

public class TaskProgressLog
{
    public long TaskProgressLogId { get; set; }
    public long TaskId { get; set; }
    public byte OldProgress { get; set; }
    public byte NewProgress { get; set; }
    public string? UpdateReason { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ProjectTask Task { get; set; } = null!;
}
