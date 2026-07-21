using BPG.Application.Common.Models;
using MediatR;
using System;
using BPG.Application.Common.Interfaces;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using BPG.Domain.Exceptions;

namespace BPG.Application.Features.Tasks.Commands;

public record UpdateTaskCommand(
    long TaskId,
    string Name,
    string? Description,
    int OrderIndex,
    DateOnly StartDate,
    DateOnly EndDate,
    string? UpdateReason,
    decimal? Weight,
    bool IsOutsourced = false,
    string? OutsourcedTeamName = null,
    string? OutsourcedTeamContact = null,
    DateOnly? ExpectedEndDate = null
) : IRequest<ApiResponse>, IRequireProjectLeader
{
    public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
    {
        var task = await unitOfWork.Repository<ProjectTask>().Query()
            .Include(t => t.Phase)
            .FirstOrDefaultAsync(t => t.TaskId == TaskId, cancellationToken);
        if (task == null) throw new NotFoundException("ProjectTask", TaskId);
        return task.Phase.ProjectId;
    }
}
