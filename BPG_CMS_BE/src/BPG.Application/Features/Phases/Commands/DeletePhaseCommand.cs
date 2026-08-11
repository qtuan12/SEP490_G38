using BPG.Application.Common.Models;
using MediatR;

namespace BPG.Application.Features.Phases.Commands;

public record DeletePhaseCommand(long PhaseId) : IRequest<ApiResponse>
{
}

