namespace BPG.Application.Features.Projects.Commands;

using MediatR;

public class CompleteProjectCommand : IRequest<MediatR.Unit>
{
    public long ProjectId { get; set; }

    public CompleteProjectCommand() { }

    public CompleteProjectCommand(long projectId)
    {
        ProjectId = projectId;
    }
}
