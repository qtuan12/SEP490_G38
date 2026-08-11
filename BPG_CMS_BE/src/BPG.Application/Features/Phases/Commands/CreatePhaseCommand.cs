using BPG.Application.Common.Models;
using MediatR;

namespace BPG.Application.Features.Phases.Commands;

public record CreatePhaseCommand(
    long ProjectId,
    string Name,
    string? Description,
    int OrderIndex,
    DateOnly? StartDate,
    DateOnly? EndDate
) : IRequest<ApiResponse<long>>
{
}

