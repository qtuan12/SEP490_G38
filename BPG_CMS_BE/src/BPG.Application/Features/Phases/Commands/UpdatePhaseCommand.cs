using BPG.Application.Common.Models;
using MediatR;

namespace BPG.Application.Features.Phases.Commands;

public record UpdatePhaseCommand(
    long PhaseId,
    string Name,
    string? Description,
    int OrderIndex,
    DateOnly? StartDate,
    DateOnly? EndDate,
    int Status
) : IRequest<ApiResponse>
{
}

