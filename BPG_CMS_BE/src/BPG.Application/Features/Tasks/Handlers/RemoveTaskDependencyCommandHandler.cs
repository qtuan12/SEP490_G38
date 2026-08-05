using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.Features.Tasks.Commands;
using BPG.Application.IServices;

namespace BPG.Application.Features.Tasks.Handlers;

public class RemoveTaskDependencyCommandHandler : IRequestHandler<RemoveTaskDependencyCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IRealtimeNotificationSender _realtimeSender;
    private readonly ICurrentUserService _currentUserService;

    public RemoveTaskDependencyCommandHandler(IUnitOfWork unitOfWork, IRealtimeNotificationSender realtimeSender, ICurrentUserService currentUserService)
    {
        _unitOfWork = unitOfWork;
        _realtimeSender = realtimeSender;
        _currentUserService = currentUserService;
    }

    public async Task<ApiResponse> Handle(RemoveTaskDependencyCommand request, CancellationToken ct)
    {
        var dep = await _unitOfWork.Repository<TaskDependency>()
            .Query()
            .Include(d => d.Task)
                .ThenInclude(t => t.Phase)
            .FirstOrDefaultAsync(d => d.TaskId == request.TaskId && d.PredecessorTaskId == request.PredecessorTaskId, ct);

        if (dep == null)
            throw new NotFoundException("TaskDependency", $"{request.TaskId}-{request.PredecessorTaskId}");

        if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager))
        {
            var currentUserId = _currentUserService.GetRequiredUserId();
            var isProjectLeader = await _unitOfWork.Repository<ProjectMember>().AnyAsync(
                member => member.ProjectId == dep.Task.Phase.ProjectId && member.UserId == currentUserId && member.IsLeader,
                ct);
            if (!isProjectLeader)
                throw new ForbiddenException("Chỉ Trưởng dự án hoặc Quản lý kỹ thuật mới được xóa liên kết phụ thuộc.");
        }

        _unitOfWork.Repository<TaskDependency>().Remove(dep);
        await _unitOfWork.SaveChangesAsync(ct);

        // Trigger realtime WBS Tree update
        if (dep.Task?.Phase != null)
        {
            await _realtimeSender.SendToGroupAsync($"Project_{dep.Task.Phase.ProjectId}", "WbsTreeUpdated", new { TaskId = dep.TaskId }, ct);
        }

        return ApiResponse.SuccessResult("Xóa liên kết phụ thuộc thành công.");
    }
}
