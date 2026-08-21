using BPG.Application.Common.Models;
using BPG.Application.DTOs.Tasks;
using BPG.Application.Features.Tasks.Queries.GetTaskDetails;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Tasks.Handlers;

public class GetTaskDetailsQueryHandler : IRequestHandler<GetTaskDetailsQuery, ApiResponse<TaskDetailsDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetTaskDetailsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse<TaskDetailsDto>> Handle(GetTaskDetailsQuery request, CancellationToken ct)
    {
        var task = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Include(t => t.Phase)
            .Include(t => t.Assignees)
                .ThenInclude(a => a.User)
            .Include(t => t.ProgressLogs)
            .Include(t => t.DailyLogs)
            .Include(t => t.SubTasks)
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        var dto = new TaskDetailsDto
        {
            TaskId = task.TaskId,
            PhaseId = task.PhaseId,
            ProjectId = task.Phase.ProjectId,
            ParentTaskId = task.ParentTaskId,
            Name = task.Name,
            Description = task.Description,
            StartDate = task.StartDate,
            EndDate = task.EndDate,
            Status = task.Status,
            ProgressPercent = task.ProgressPercent,
            ObsoleteReason = task.ObsoleteReason,
            HasSubTasks = task.SubTasks.Any(),
            Assignees = task.Assignees.Select(a => new TaskAssigneeDto(
                a.UserId,
                a.User.FullName,
                a.User.Email
            )).ToList(),
            ProgressLogs = task.ProgressLogs.OrderByDescending(p => p.CreatedAt != default ? p.CreatedAt : (p.UpdatedAt ?? DateTime.UtcNow)).Select(p => new TaskProgressLogDto(
                p.TaskProgressLogId,
                p.OldProgress,
                p.NewProgress,
                p.UpdateReason,
                p.UpdatedAt ?? p.CreatedAt,
                p.CreatedBy,
                null
            )).ToList(),
            DailyLogs = task.DailyLogs.OrderByDescending(d => d.LogDate).Select(d => new TaskDailyLogDto(
                d.LogId,
                d.LogDate,
                d.Description,
                d.NewProgressPercent,
                new List<string>()
            )).ToList()
        };

        return ApiResponse<TaskDetailsDto>.SuccessResult(dto);
    }
}
