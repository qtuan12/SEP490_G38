namespace BPG.Application.Features.Projects.Commands;

using MediatR;

public record ActivateProjectCommand(long ProjectId) : IRequest<MediatR.Unit>;
