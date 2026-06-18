using MediatR;

namespace BPG.Application.Features.Projects.Commands;

public class RemoveProjectMemberCommand : IRequest<bool>
{
    public long ProjectId { get; set; }
    public long UserId { get; set; }
}
