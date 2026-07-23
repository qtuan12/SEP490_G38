using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BPG.Application.Features.Tasks.Commands;

namespace BPG.Application.Features.Tasks.Handlers;

public class MarkTaskObsoleteCommandHandler : IRequestHandler<MarkTaskObsoleteCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProgressRollupService _rollupService;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotificationSender _realtimeSender;
    private readonly ICurrentUserService _currentUserService;

    public MarkTaskObsoleteCommandHandler(IUnitOfWork unitOfWork, IProgressRollupService rollupService, INotificationService notificationService, IRealtimeNotificationSender realtimeSender, ICurrentUserService currentUserService)
    {
        _unitOfWork = unitOfWork;
        _rollupService = rollupService;
        _notificationService = notificationService;
        _realtimeSender = realtimeSender;
        _currentUserService = currentUserService;
    }

    public async Task<ApiResponse> Handle(MarkTaskObsoleteCommand request, CancellationToken ct)
    {
        var currentUserId = _currentUserService.GetRequiredUserId();

        var task = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Include(t => t.Assignees)
            .Include(t => t.Phase)
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        // Phân quyền: Phải là TechnicalManager hoặc là Leader của dự án
        bool isTechnicalManager = _currentUserService.IsInRole("TechnicalManager");
        bool isProjectLeader = false;
        
        if (!isTechnicalManager)
        {
            var member = await _unitOfWork.Repository<ProjectMember>()
                .Query()
                .FirstOrDefaultAsync(m => m.ProjectId == task.Phase.ProjectId && m.UserId == currentUserId, ct);
            if (member != null && member.IsLeader)
            {
                isProjectLeader = true;
            }

            if (!isProjectLeader)
            {
                throw new ForbiddenException("Chỉ Quản lý dự án hoặc Trưởng phòng Kỹ thuật mới có quyền tạm dừng công việc.");
            }
        }

        if (task.Status == BPG.Domain.Constants.TaskStatus.Obsolete)
            return ApiResponse.SuccessResult("Task đã ở trạng thái Obsolete.");

        var oldProgress = task.ProgressPercent;
        task.Status = BPG.Domain.Constants.TaskStatus.Obsolete;
        task.ObsoleteReason = request.ObsoleteReason;

        var currentUser = await _unitOfWork.Repository<User>().GetByIdAsync(currentUserId);
        var userName = currentUser?.FullName ?? "Unknown User";

        task.ProgressLogs.Add(new TaskProgressLog
        {
            OldProgress = oldProgress,
            NewProgress = oldProgress, // Giữ nguyên tiến độ, chỉ đổi trạng thái
            UpdateReason = $"Công việc bị tạm dừng, người dừng: {userName}. Lý do: {request.ObsoleteReason}",
            UpdatedAt = DateTime.UtcNow
        });

        _unitOfWork.Repository<ProjectTask>().Update(task);
        await _unitOfWork.SaveChangesAsync(ct);

        // Cuộn tiến độ (sẽ bỏ qua task này vì đã obsolete)
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
                title: "Công việc bị hủy bỏ",
                content: $"Công việc {task.Name} đã được đánh dấu là lỗi thời/bị hủy bỏ do: {request.ObsoleteReason}.",
                notificationType: BPG.Domain.Constants.NotificationType.System,
                referenceType: BPG.Domain.Constants.NotificationReferenceType.Task,
                referenceId: task.TaskId,
                ct: ct);
        }

        if (task.Phase != null)
        {
            await _realtimeSender.SendToGroupAsync($"Project_{task.Phase.ProjectId}", "WbsTreeUpdated", new { TaskId = task.TaskId }, ct);

            // Gửi thông báo chéo giữa Trưởng phòng Kỹ thuật và Quản lý dự án
            if (isTechnicalManager)
            {
                var projectLeaderId = await _unitOfWork.Repository<ProjectMember>().Query()
                    .Where(m => m.ProjectId == task.Phase.ProjectId && m.IsLeader && m.UserId != currentUserId)
                    .Select(m => m.UserId)
                    .FirstOrDefaultAsync(ct);

                if (projectLeaderId > 0)
                {
                    await _notificationService.SendNotificationAsync(
                        userId: projectLeaderId,
                        title: "Công việc bị tạm dừng",
                        content: $"Công việc '{task.Name}' đã bị tạm dừng bởi Trưởng phòng kỹ thuật. Lý do: {request.ObsoleteReason}.",
                        notificationType: BPG.Domain.Constants.NotificationType.System,
                        referenceType: BPG.Domain.Constants.NotificationReferenceType.Task,
                        referenceId: task.TaskId,
                        ct: ct);
                }
            }
            else if (isProjectLeader)
            {
                await _notificationService.SendNotificationToRoleAsync(
                    roleName: BPG.Domain.Constants.UserRole.TechnicalManager,
                    title: "Công việc bị tạm dừng",
                    content: $"Công việc '{task.Name}' đã bị tạm dừng bởi Quản lý dự án. Lý do: {request.ObsoleteReason}.",
                    notificationType: BPG.Domain.Constants.NotificationType.System,
                    excludeUserId: currentUserId,
                    referenceType: BPG.Domain.Constants.NotificationReferenceType.Task,
                    referenceId: task.TaskId,
                    ct: ct);
            }
        }

        await CascadeObsoleteDependentTasksAsync(task.TaskId, request.ObsoleteReason, userName, ct);
        await CascadeObsoleteChildTasksAsync(task.TaskId, request.ObsoleteReason, userName, ct);

        return ApiResponse.SuccessResult("Đánh dấu task lỗi thời thành công.");
    }

    private async Task CascadeObsoleteDependentTasksAsync(long predecessorTaskId, string obsoleteReason, string userName, CancellationToken ct)
    {
        // Find all tasks that depend on the predecessorTaskId
        var dependentTaskIds = await _unitOfWork.Repository<TaskDependency>()
            .Query()
            .Where(d => d.PredecessorTaskId == predecessorTaskId)
            .Select(d => d.TaskId)
            .ToListAsync(ct);

        foreach (var depTaskId in dependentTaskIds)
        {
            var dependentTask = await _unitOfWork.Repository<ProjectTask>()
                .Query()
                .Include(t => t.Assignees)
                .Include(t => t.Phase)
                .FirstOrDefaultAsync(t => t.TaskId == depTaskId, ct);

            if (dependentTask != null && dependentTask.Status != BPG.Domain.Constants.TaskStatus.Obsolete)
            {
                var oldProgress = dependentTask.ProgressPercent;
                dependentTask.Status = BPG.Domain.Constants.TaskStatus.Obsolete;
                dependentTask.ObsoleteReason = $"Tự động tạm dừng do công việc phụ thuộc bị dừng: {obsoleteReason}";

                dependentTask.ProgressLogs.Add(new TaskProgressLog
                {
                    OldProgress = oldProgress,
                    NewProgress = oldProgress,
                    UpdateReason = $"Công việc bị tạm dừng, người dừng: hệ thống tự động (do task phụ thuộc bị dừng bởi {userName}). Lý do: {obsoleteReason}",
                    UpdatedAt = DateTime.UtcNow
                });

                _unitOfWork.Repository<ProjectTask>().Update(dependentTask);
                await _unitOfWork.SaveChangesAsync(ct);

                if (dependentTask.ParentTaskId.HasValue)
                {
                    await _rollupService.RecalculateParentTaskProgressAsync(dependentTask.ParentTaskId.Value, dependentTask.TaskId, ct);
                    await _unitOfWork.SaveChangesAsync(ct);
                }

                foreach (var assignee in dependentTask.Assignees)
                {
                    await _notificationService.SendNotificationAsync(
                        userId: assignee.UserId,
                        title: "Công việc bị tự động tạm dừng",
                        content: $"Công việc {dependentTask.Name} đã tự động bị tạm dừng do công việc trước nó bị tạm dừng.",
                        notificationType: BPG.Domain.Constants.NotificationType.System,
                        referenceType: BPG.Domain.Constants.NotificationReferenceType.Task,
                        referenceId: dependentTask.TaskId,
                        ct: ct);
                }

                if (dependentTask.Phase != null)
                {
                    await _realtimeSender.SendToGroupAsync($"Project_{dependentTask.Phase.ProjectId}", "WbsTreeUpdated", new { TaskId = dependentTask.TaskId }, ct);
                }

                // Recursively obsolete downstream dependent tasks
                await CascadeObsoleteDependentTasksAsync(dependentTask.TaskId, obsoleteReason, userName, ct);
                // Recursively obsolete child tasks
                await CascadeObsoleteChildTasksAsync(dependentTask.TaskId, obsoleteReason, userName, ct);
            }
        }
    }
    private async Task CascadeObsoleteChildTasksAsync(long parentTaskId, string obsoleteReason, string userName, CancellationToken ct)
    {
        var childTaskIds = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Where(t => t.ParentTaskId == parentTaskId && t.Status != BPG.Domain.Constants.TaskStatus.Obsolete)
            .Select(t => t.TaskId)
            .ToListAsync(ct);

        foreach (var childTaskId in childTaskIds)
        {
            var childTask = await _unitOfWork.Repository<ProjectTask>()
                .Query()
                .Include(t => t.Assignees)
                .Include(t => t.Phase)
                .FirstOrDefaultAsync(t => t.TaskId == childTaskId, ct);

            if (childTask != null && childTask.Status != BPG.Domain.Constants.TaskStatus.Obsolete)
            {
                var oldProgress = childTask.ProgressPercent;
                childTask.Status = BPG.Domain.Constants.TaskStatus.Obsolete;
                childTask.ObsoleteReason = $"Tự động tạm dừng do công việc cha bị dừng: {obsoleteReason}";

                childTask.ProgressLogs.Add(new TaskProgressLog
                {
                    OldProgress = oldProgress,
                    NewProgress = oldProgress,
                    UpdateReason = $"Công việc bị tạm dừng, người dừng: hệ thống tự động (do task cha bị dừng bởi {userName}). Lý do: {obsoleteReason}",
                    UpdatedAt = DateTime.UtcNow
                });

                _unitOfWork.Repository<ProjectTask>().Update(childTask);
                await _unitOfWork.SaveChangesAsync(ct);

                // Note: No need to roll up progress to parent because parent is already obsolete!

                foreach (var assignee in childTask.Assignees)
                {
                    await _notificationService.SendNotificationAsync(
                        userId: assignee.UserId,
                        title: "Công việc bị tự động tạm dừng",
                        content: $"Công việc '{childTask.Name}' đã tự động bị tạm dừng do công việc cha của nó bị tạm dừng.",
                        notificationType: BPG.Domain.Constants.NotificationType.System,
                        referenceType: BPG.Domain.Constants.NotificationReferenceType.Task,
                        referenceId: childTask.TaskId,
                        ct: ct);
                }

                if (childTask.Phase != null)
                {
                    await _realtimeSender.SendToGroupAsync($"Project_{childTask.Phase.ProjectId}", "WbsTreeUpdated", new { TaskId = childTask.TaskId }, ct);
                }

                // Recursively obsolete downstream dependent tasks
                await CascadeObsoleteDependentTasksAsync(childTask.TaskId, obsoleteReason, userName, ct);
                // Recursively obsolete child tasks
                await CascadeObsoleteChildTasksAsync(childTask.TaskId, obsoleteReason, userName, ct);
            }
        }
    }
}
