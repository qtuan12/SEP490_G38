using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BPG.Application.IServices;
using BPG.Application.Features.Tasks.Commands;

namespace BPG.Application.Features.Tasks.Handlers;

public class DeleteTaskCommandHandler : IRequestHandler<DeleteTaskCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IRealtimeNotificationSender _realtimeSender;
    private readonly ICurrentUserService _currentUserService;
    private readonly IProgressRollupService _rollupService;

    public DeleteTaskCommandHandler(IUnitOfWork unitOfWork, IRealtimeNotificationSender realtimeSender, ICurrentUserService currentUserService, IProgressRollupService rollupService)
    {
        _unitOfWork = unitOfWork;
        _realtimeSender = realtimeSender;
        _currentUserService = currentUserService;
        _rollupService = rollupService;
    }

    public async Task<ApiResponse> Handle(DeleteTaskCommand request, CancellationToken ct)
    {
        var task = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Include(t => t.Phase)
            .ThenInclude(p => p.Project)
            .Include(t => t.SubTasks)
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        if (task.Phase != null && task.Phase.Project.Status != BPG.Domain.Constants.ProjectStatus.InProgress && task.Phase.Project.Status != BPG.Domain.Constants.ProjectStatus.Draft)
            throw new BusinessException(BPG.Domain.Constants.ErrorCodes.InvalidTransition, "Dự án phải ở trạng thái Nháp hoặc Đang hoạt động để thực hiện thao tác này.");

        if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager))
        {
            var currentUserId = _currentUserService.GetRequiredUserId();
            var isProjectLeader = await _unitOfWork.Repository<ProjectMember>()
                .Query()
                .AnyAsync(pm => pm.ProjectId == task.Phase!.ProjectId && pm.UserId == currentUserId && pm.IsLeader, ct);
                
            if (!isProjectLeader)
            {
                throw new ForbiddenException("Chỉ Trưởng dự án hoặc Quản lý kỹ thuật mới được phép xóa công việc.");
            }
        }

        if (task.ProgressPercent > 0)
            throw new BusinessException("ERR_TASK_IN_PROGRESS", "Không thể xóa công việc đã có tiến độ thực hiện (> 0%).");

        // Soft delete subtasks also recursively? The requirement doesn't specify deeply nested tasks, but let's delete subtasks
        foreach (var subTask in task.SubTasks)
        {
            if (subTask.ProgressPercent > 0)
                throw new BusinessException("ERR_SUBTASK_IN_PROGRESS", "Không thể xóa task vì có task con đã có tiến độ (> 0%).");
            
            _unitOfWork.Repository<ProjectTask>().Remove(subTask);
        }

        _unitOfWork.Repository<ProjectTask>().Remove(task);
        await _unitOfWork.SaveChangesAsync(ct);

        if (task.ParentTaskId.HasValue)
        {
            await _rollupService.RecalculateParentTaskProgressAsync(task.ParentTaskId.Value, null, ct);
        }
        else
        {
            await _rollupService.UpdatePhaseStatusAsync(task.PhaseId, ct);
        }

        if (task.Phase != null)
        {
            await _realtimeSender.SendToGroupAsync($"Project_{task.Phase.ProjectId}", "WbsTreeUpdated", new { TaskId = task.TaskId }, ct);
        }

        return ApiResponse.SuccessResult("Xóa task thành công.");
    }
}
