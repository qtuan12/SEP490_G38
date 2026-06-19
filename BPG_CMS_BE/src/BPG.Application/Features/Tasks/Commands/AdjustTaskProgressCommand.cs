using BPG.Application.Common.Models;
using MediatR;

namespace BPG.Application.Features.Tasks.Commands;

public record AdjustTaskProgressCommand(
    long TaskId,
    byte NewProgress,
    string UpdateReason
) : IRequest<ApiResponse>;
