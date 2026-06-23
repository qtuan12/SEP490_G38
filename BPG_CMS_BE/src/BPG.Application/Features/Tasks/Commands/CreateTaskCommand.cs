using BPG.Application.Common.Models;
using MediatR;
using System;
using System.Collections.Generic;

namespace BPG.Application.Features.Tasks.Commands;

public record CreateTaskCommand(
    long PhaseId,
    long? ParentTaskId,
    string Name,
    string? Description,
    int OrderIndex,
    DateOnly StartDate,
    DateOnly EndDate,
    List<long>? AssigneeIds,
    decimal? Weight
) : IRequest<ApiResponse<long>>;
