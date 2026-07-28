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
) : IRequest<ApiResponse<long>>, IRequireProjectLeader
{
    public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
    {
        var phase = await unitOfWork.Repository<Phase>().Query()
            .FirstOrDefaultAsync(p => p.PhaseId == PhaseId, cancellationToken);
        if (phase == null) throw new NotFoundException("Phase", PhaseId);
        return phase.ProjectId;
    }
}
