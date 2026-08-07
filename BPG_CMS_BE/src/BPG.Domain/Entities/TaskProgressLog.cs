namespace BPG.Domain.Entities;

public class TaskProgressLog : BaseEntity
{
    public long TaskProgressLogId { get; set; }
    public long TaskId { get; set; }
    public byte OldProgress { get; set; }
    public byte NewProgress { get; set; }
    public string? UpdateReason { get; set; }

    public ProjectTask Task { get; set; } = null!;
    public User? Creator { get; set; }
}
