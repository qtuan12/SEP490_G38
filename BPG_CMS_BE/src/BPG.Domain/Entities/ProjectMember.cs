namespace BPG.Domain.Entities;

public class ProjectMember : BaseEntity
{
    public long ProjectMemberId { get; set; }
    public long ProjectId { get; set; }
    public long UserId { get; set; }
    public bool IsLeader { get; set; } = false;
    public DateTime JoinedAt { get; set; }

    public Project Project { get; set; } = null!;
    public User User { get; set; } = null!;
}
