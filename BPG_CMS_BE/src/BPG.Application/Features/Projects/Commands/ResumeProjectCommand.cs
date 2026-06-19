using MediatR;

namespace BPG.Application.Features.Projects.Commands;

public class ResumeProjectCommand : IRequest<bool>
{
    public long ProjectId { get; set; }
}
