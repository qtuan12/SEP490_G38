using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BPG.Application.Features.Tasks.Commands;

namespace BPG.Application.Features.Tasks.Handlers;

public class AdjustTaskProgressCommandHandler : IRequestHandler<AdjustTaskProgressCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProgressRollupService _rollupService;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotificationSender _realtimeSender;

    public AdjustTaskProgressCommandHandler(IUnitOfWork unitOfWork, IProgressRollupService rollupService, INotificationService notificationService, IRealtimeNotificationSender realtimeSender)
    {
        _unitOfWork = unitOfWork;
        _rollupService = rollupService;
        _notificationService = notificationService;
        _realtimeSender = realtimeSender;
    }

    public async Task<ApiResponse> Handle(AdjustTaskProgressCommand request, CancellationToken ct)
    {
        var task = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Include(t => t.Assignees)
            .Include(t => t.Phase)
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        if (task.Status == BPG.Domain.Constants.TaskStatus.Obsolete)
            throw new BusinessException("ERR_TASK_OBSOLETE", "Không thể điều chỉnh tiến độ cho công việc đã báo lỗi thời.");

        // Kiểm tra điều kiện phụ thuộc (Finish-to-Start)
        if (request.NewProgress > 0)
        {
            var incompletePredecessors = await _unitOfWork.Repository<TaskDependency>()
                .Query()
                .Include(td => td.Predecessor)
                .Where(td => td.TaskId == task.TaskId 
                    && td.Predecessor.ProgressPercent < 100
                    && td.Predecessor.Status != BPG.Domain.Constants.TaskStatus.Obsolete)
                .ToListAsync(ct);

            if (incompletePredecessors.Any())
            {
                // Tìm tất cả các ancestor IDs để loại trừ khỏi danh sách chặn
                var ancestorIds = new System.Collections.Generic.HashSet<long>();
                long? currentParentId = task.ParentTaskId;
                while (currentParentId.HasValue)
                {
                    ancestorIds.Add(currentParentId.Value);
                    var parent = await _unitOfWork.Repository<ProjectTask>()
                        .Query()
                        .Select(t => new { t.TaskId, t.ParentTaskId })
                        .FirstOrDefaultAsync(t => t.TaskId == currentParentId.Value, ct);
                    currentParentId = parent?.ParentTaskId;
                }

                var blockedPredecessors = incompletePredecessors
                    .Where(td => !ancestorIds.Contains(td.PredecessorTaskId))
                    .ToList();

                if (blockedPredecessors.Any())
                {
                    var names = string.Join(", ", blockedPredecessors.Select(td => td.Predecessor.Name));
                    throw new BusinessException("ERR_TASK_DEPENDENCY_BLOCKED",
                        $"Không thể điều chỉnh tiến độ. Các công việc tiên quyết chưa hoàn thành: {names}");
                }
            }
        }

        var oldProgress = task.ProgressPercent;
        task.ProgressPercent = request.NewProgress;
        
        if (request.NewProgress == 100)
            task.Status = BPG.Domain.Constants.TaskStatus.Completed;
        else if (request.NewProgress > 0 && request.NewProgress < 100)
            task.Status = BPG.Domain.Constants.TaskStatus.InProgress;

        task.ProgressLogs.Add(new TaskProgressLog
        {
            OldProgress = oldProgress,
            NewProgress = request.NewProgress,
            UpdateReason = request.UpdateReason,
            UpdatedAt = DateTime.UtcNow
        });

        _unitOfWork.Repository<ProjectTask>().Update(task);
        await _unitOfWork.SaveChangesAsync(ct);

        // Cuộn tiến độ
        if (task.ParentTaskId.HasValue)
        {
            await _rollupService.RecalculateParentTaskProgressAsync(task.ParentTaskId.Value, task.TaskId, ct);
            await _unitOfWork.SaveChangesAsync(ct);
        }

        // Notify assignees
        foreach (var assignee in task.Assignees)
        {
            await _notificationService.SendNotificationAsync(
                userId: assignee.UserId,
                title: "Tiến độ công việc bị điều chỉnh",
                content: $"Công việc {task.Name} đã bị điều chỉnh tiến độ thành {request.NewProgress}% với lý do: {request.UpdateReason}.",
                notificationType: BPG.Domain.Constants.NotificationType.Progress,
                referenceType: BPG.Domain.Constants.NotificationReferenceType.Task,
                referenceId: task.TaskId,
                ct: ct);
        }

        // Trigger realtime WBS Tree update
        if (task.Phase != null)
        {
            await _realtimeSender.SendToGroupAsync($"Project_{task.Phase.ProjectId}", "WbsTreeUpdated", new { TaskId = task.TaskId }, ct);
        }

        return ApiResponse.SuccessResult("Điều chỉnh tiến độ task thành công.");
    }
}
