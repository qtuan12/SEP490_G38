using BPG.Application.Common.Models;
using MediatR;

namespace BPG.Application.Features.Phases.Commands;

public record ClonePhaseCommand(long ProjectId, long PhaseId) : IRequest<ApiResponse<long>>;
