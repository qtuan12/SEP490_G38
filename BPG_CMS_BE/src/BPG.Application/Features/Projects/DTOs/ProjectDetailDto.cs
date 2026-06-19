namespace BPG.Application.Features.Projects.DTOs;

public class ProjectDetailDto : ProjectDto
{
    public List<ProjectMemberDto> Members { get; set; } = new();
    public List<AttachmentDto> Attachments { get; set; } = new();
}
