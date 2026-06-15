using MediatR;

namespace BPG.Application.Features.Projects.Commands;

public class DeleteProjectCommand : IRequest<bool>
{
    public long ProjectId { get; set; }
}
