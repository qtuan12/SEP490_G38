using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Tasks.Queries.GetTaskDetails;

public record TaskAssigneeDto(long UserId, string FullName, string Email);

public record TaskDailyLogDto(long DailyLogId, DateOnly LogDate, string Content, byte ProgressPercentAdded, List<string> ImageUrls);

public record TaskProgressLogDto(long LogId, byte OldProgress, byte NewProgress, string? UpdateReason, DateTime UpdatedAt);

public record TaskDetailsDto
{
    public long TaskId { get; set; }
    public long PhaseId { get; set; }
    public long? ParentTaskId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public byte ProgressPercent { get; set; }
    public string? ObsoleteReason { get; set; }

    public List<TaskAssigneeDto> Assignees { get; set; } = new();
    public List<TaskDailyLogDto> DailyLogs { get; set; } = new();
    public List<TaskProgressLogDto> ProgressLogs { get; set; } = new();
}

public record GetTaskDetailsQuery(long TaskId) : IRequest<ApiResponse<TaskDetailsDto>>;

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
            .Include(t => t.Assignees)
                .ThenInclude(a => a.User)
            .Include(t => t.ProgressLogs)
            .Include(t => t.DailyLogs)
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        var dto = new TaskDetailsDto
        {
            TaskId = task.TaskId,
            PhaseId = task.PhaseId,
            ParentTaskId = task.ParentTaskId,
            Name = task.Name,
            Description = task.Description,
            StartDate = task.StartDate,
            EndDate = task.EndDate,
            Status = task.Status,
            ProgressPercent = task.ProgressPercent,
            ObsoleteReason = task.ObsoleteReason,
            Assignees = task.Assignees.Select(a => new TaskAssigneeDto(
                a.UserId,
                a.User.FullName,
                a.User.Email
            )).ToList(),
            ProgressLogs = task.ProgressLogs.OrderByDescending(p => p.UpdatedAt).Select(p => new TaskProgressLogDto(
                p.TaskProgressLogId,
                p.OldProgress,
                p.NewProgress,
                p.UpdateReason,
                p.UpdatedAt
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
