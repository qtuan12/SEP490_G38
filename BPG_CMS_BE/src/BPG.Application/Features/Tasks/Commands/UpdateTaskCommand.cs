using BPG.Application.Common.Models;
using MediatR;
using System;

namespace BPG.Application.Features.Tasks.Commands;

public record UpdateTaskCommand(
    long TaskId,
    string Name,
    string? Description,
    int OrderIndex,
    DateOnly StartDate,
    DateOnly EndDate,
    string? UpdateReason
) : IRequest<ApiResponse>;
