using BPG.Application.Features.Projects.DTOs;
using MediatR;

namespace BPG.Application.Features.Projects.Commands;

public class AddProjectMemberCommand : IRequest<ProjectMemberDto>
{
    public long ProjectId { get; set; }
    public long UserId { get; set; }
}
