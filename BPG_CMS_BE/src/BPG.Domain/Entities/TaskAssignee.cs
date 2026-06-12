namespace BPG.Domain.Entities;

public class TaskAssignee
{
    public long TaskId { get; set; }
    public long UserId { get; set; }
    public DateTime AssignedAt { get; set; }

    public ProjectTask Task { get; set; } = null!;
    public User User { get; set; } = null!;
}
