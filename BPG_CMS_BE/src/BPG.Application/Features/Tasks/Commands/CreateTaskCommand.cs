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
    decimal? Weight,
    bool IsOutsourced = false,
    string? OutsourcedTeamName = null,
    string? OutsourcedTeamContact = null
) : IRequest<ApiResponse<long>>;
