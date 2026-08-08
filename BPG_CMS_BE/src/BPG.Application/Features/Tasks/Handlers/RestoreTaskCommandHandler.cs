using BPG.Application.Common.Models;
using BPG.Application.Features.Tasks.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Tasks.Handlers;

public class RestoreTaskCommandHandler : IRequestHandler<RestoreTaskCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProgressRollupService _rollupService;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotificationSender _realtimeSender;
    private readonly ICurrentUserService _currentUserService;

    public RestoreTaskCommandHandler(IUnitOfWork unitOfWork, IProgressRollupService rollupService, INotificationService notificationService, IRealtimeNotificationSender realtimeSender, ICurrentUserService currentUserService)
    {
        _unitOfWork = unitOfWork;
        _rollupService = rollupService;
        _notificationService = notificationService;
        _realtimeSender = realtimeSender;
        _currentUserService = currentUserService;
    }

    public async Task<ApiResponse> Handle(RestoreTaskCommand request, CancellationToken ct)
    {
        var currentUserId = _currentUserService.GetRequiredUserId();

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

        if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager))
        {
            var isProjectLeader = await _unitOfWork.Repository<ProjectMember>().AnyAsync(
                member => member.ProjectId == task.Phase!.ProjectId && member.UserId == currentUserId && member.IsLeader,
                ct);
            if (!isProjectLeader)
                throw new ForbiddenException("Chỉ Trưởng dự án hoặc Quản lý kỹ thuật mới được phép khôi phục công việc.");
        }

        if (task.Status != BPG.Domain.Constants.TaskStatus.Obsolete)
            return ApiResponse.SuccessResult("Task không ở trạng thái Obsolete để khôi phục.");

        if (!string.IsNullOrEmpty(task.ObsoleteReason) && (task.ObsoleteReason.Contains("Sự cố khẩn cấp") || task.ObsoleteReason.Contains("Sự cố")))
        {
            throw new BusinessException("ERR_TASK_CANNOT_BE_RESTORED", "Công việc này đã bị hủy/thay thế do xử lý sự cố thi công và không thể khôi phục.");
        }

        var hasObsoletePredecessor = await _unitOfWork.Repository<TaskDependency>()
            .Query()
            .Include(d => d.Predecessor)
            .AnyAsync(d => d.TaskId == request.TaskId && d.Predecessor.Status == BPG.Domain.Constants.TaskStatus.Obsolete, ct);

        if (hasObsoletePredecessor)
        {
            throw new BusinessException("ERR_DEPENDENCY_OBSOLETE", "Không thể khôi phục công việc này vì công việc đi trước vẫn đang bị tạm dừng.");
        }

        var oldProgress = task.ProgressPercent;
        
        // Khôi phục trạng thái
        if (oldProgress == 100)
            task.Status = BPG.Domain.Constants.TaskStatus.Completed;
        else if (oldProgress > 0)
            task.Status = BPG.Domain.Constants.TaskStatus.InProgress;
        else
            task.Status = task.Assignees.Any() ? BPG.Domain.Constants.TaskStatus.Assigned : BPG.Domain.Constants.TaskStatus.New;
            
        task.ObsoleteReason = null;

        var currentUser = await _unitOfWork.Repository<User>().GetByIdAsync(currentUserId);
        var userName = currentUser?.FullName ?? "Unknown User";

        task.ProgressLogs.Add(new TaskProgressLog
        {
            OldProgress = oldProgress,
            NewProgress = oldProgress,
            UpdateReason = $"Công việc được khôi phục, người khôi phục: {userName}.",
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
                title: "Công việc được khôi phục",
                content: $"Công việc {task.Name} đã được khôi phục để tiếp tục thực hiện.",
                notificationType: BPG.Domain.Constants.NotificationType.System,
                referenceType: BPG.Domain.Constants.NotificationReferenceType.Task,
                referenceId: task.TaskId,
                ct: ct);
        }

        if (task.Phase != null)
        {
            await _realtimeSender.SendToGroupAsync($"Project_{task.Phase.ProjectId}", "WbsTreeUpdated", new { TaskId = task.TaskId }, ct);
        }

        return ApiResponse.SuccessResult("Khôi phục task thành công.");
    }
}
