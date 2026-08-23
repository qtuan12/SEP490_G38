using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BPG.Application.Features.Tasks.Commands;
using BPG.Domain.Constants;

namespace BPG.Application.Features.Tasks.Handlers;

public class AdjustTaskProgressCommandHandler : IRequestHandler<AdjustTaskProgressCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProgressRollupService _rollupService;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotificationSender _realtimeSender;
    private readonly ICurrentUserService _currentUserService;

    public AdjustTaskProgressCommandHandler(IUnitOfWork unitOfWork, IProgressRollupService rollupService, INotificationService notificationService, IRealtimeNotificationSender realtimeSender, ICurrentUserService currentUserService)
    {
        _unitOfWork = unitOfWork;
        _rollupService = rollupService;
        _notificationService = notificationService;
        _realtimeSender = realtimeSender;
        _currentUserService = currentUserService;
    }

    public async Task<ApiResponse> Handle(AdjustTaskProgressCommand request, CancellationToken ct)
    {
        var task = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Include(t => t.Assignees)
            .Include(t => t.Phase)
            .ThenInclude(p => p.Project)
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        if (task.Phase != null && task.Phase.Project.Status != BPG.Domain.Constants.ProjectStatus.InProgress)
            throw new BusinessException(BPG.Domain.Constants.ErrorCodes.InvalidTransition, "Dự án phải đang hoạt động để thực hiện thao tác này.");

        if (task.Status == BPG.Domain.Constants.TaskStatus.Obsolete)
            throw new BusinessException("ERR_TASK_OBSOLETE", "Không thể điều chỉnh tiến độ cho công việc đã báo lỗi thời.");

        var currentUserId = _currentUserService.GetRequiredUserId();
        var isManager = _currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.TechnicalManager);
        if (!isManager)
        {
            throw new ForbiddenException("Chỉ Trưởng phòng kỹ thuật hoặc Quản trị viên mới được phép điều chỉnh tiến độ trực tiếp.");
        }

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

        await _unitOfWork.BeginTransactionAsync(ct);

        try
        {
            var oldProgress = task.ProgressPercent;
            task.ProgressPercent = request.NewProgress;

            if (request.NewProgress == 100)
                task.Status = BPG.Domain.Constants.TaskStatus.Completed;
            else if (request.NewProgress > 0 && request.NewProgress < 100)
                task.Status = BPG.Domain.Constants.TaskStatus.InProgress;
            else
                task.Status = task.Assignees.Any()
                    ? BPG.Domain.Constants.TaskStatus.Assigned
                    : BPG.Domain.Constants.TaskStatus.New;

            task.ProgressLogs.Add(new TaskProgressLog
            {
                OldProgress = oldProgress,
                NewProgress = request.NewProgress,
                UpdateReason = $"Điều chỉnh trực tiếp: {request.UpdateReason}",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = currentUserId,
                UpdatedAt = DateTime.UtcNow,
                UpdatedBy = currentUserId
            });

            _unitOfWork.Repository<ProjectTask>().Update(task);
            await _unitOfWork.SaveChangesAsync(ct);

            // Cuộn tiến độ
            if (task.ParentTaskId.HasValue)
            {
                await _rollupService.RecalculateParentTaskProgressAsync(task.ParentTaskId.Value, task.TaskId, ct);
                await _unitOfWork.SaveChangesAsync(ct);
            }
            else
            {
                await _rollupService.UpdatePhaseStatusAsync(task.PhaseId, ct);
                await _unitOfWork.SaveChangesAsync(ct);
            }

            await _unitOfWork.CommitTransactionAsync(ct);
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(CancellationToken.None);
            throw;
        }

        var projectId = task.Phase?.ProjectId ?? 0;
        var notificationContent = request.NewProgress < task.ProgressPercent
            ? $"Tiến độ công việc \"{task.Name}\" đã bị TPKT điều chỉnh giảm xuống {request.NewProgress}% với lý do: {request.UpdateReason}."
            : $"Tiến độ công việc \"{task.Name}\" đã được TPKT điều chỉnh lên {request.NewProgress}% với lý do: {request.UpdateReason}.";

        // Thông báo cho các kỹ sư được phân công
        foreach (var assignee in task.Assignees)
        {
            await _notificationService.SendNotificationAsync(
                userId: assignee.UserId,
                title: "Tiến độ công việc bị điều chỉnh trực tiếp",
                content: notificationContent,
                notificationType: BPG.Domain.Constants.NotificationType.Progress,
                referenceType: BPG.Domain.Constants.NotificationReferenceType.Task,
                referenceId: task.TaskId,
                ct: ct);
        }

        // Thông báo cho Project Leader của dự án (nếu khác với người thực hiện)
        if (projectId > 0)
        {
            var projectLeaders = await _unitOfWork.Repository<ProjectMember>()
                .Query()
                .Where(pm => pm.ProjectId == projectId && pm.IsLeader && pm.UserId != currentUserId)
                .ToListAsync(ct);

            foreach (var leader in projectLeaders)
            {
                await _notificationService.SendNotificationAsync(
                    userId: leader.UserId,
                    title: "Tiến độ công việc bị điều chỉnh trực tiếp",
                    content: notificationContent,
                    notificationType: BPG.Domain.Constants.NotificationType.Progress,
                    referenceType: BPG.Domain.Constants.NotificationReferenceType.Task,
                    referenceId: task.TaskId,
                    ct: ct);
            }
        }

        // Trigger realtime WBS Tree update
        if (task.Phase != null)
        {
            await _realtimeSender.SendToGroupAsync($"Project_{task.Phase.ProjectId}", "WbsTreeUpdated", new { TaskId = task.TaskId }, ct);
        }

        return ApiResponse.SuccessResult("Điều chỉnh tiến độ task thành công.");
    }
}
