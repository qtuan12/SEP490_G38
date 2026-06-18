using MediatR;

namespace BPG.Application.Features.Projects.Commands;

public class PauseProjectCommand : IRequest<bool>
{
    public long ProjectId { get; set; }
    public string PauseReason { get; set; } = string.Empty;
}
