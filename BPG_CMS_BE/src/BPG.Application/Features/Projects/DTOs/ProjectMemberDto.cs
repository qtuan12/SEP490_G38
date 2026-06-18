namespace BPG.Application.Features.Projects.DTOs;

public class ProjectMemberDto
{
    public long ProjectMemberId { get; set; }
    public long ProjectId { get; set; }
    public long UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string Role { get; set; } = string.Empty;
    public bool IsLeader { get; set; }
    public DateTime JoinedAt { get; set; }
}
