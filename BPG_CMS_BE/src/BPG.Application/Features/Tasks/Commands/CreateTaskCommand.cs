using BPG.Application.Common.Models;
using MediatR;
using System;
using System.Collections.Generic;
using BPG.Application.Common.Interfaces;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using BPG.Domain.Exceptions;
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;

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
) : IRequest<ApiResponse<long>>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.Phase(PhaseId);
    public string RequiredPermission => ProjectPermission.ExecutionManage;
}
