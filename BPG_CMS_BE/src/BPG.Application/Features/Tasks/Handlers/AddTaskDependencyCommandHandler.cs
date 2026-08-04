using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.Features.Tasks.Commands;
using BPG.Application.IServices;

namespace BPG.Application.Features.Tasks.Handlers;

public class AddTaskDependencyCommandHandler : IRequestHandler<AddTaskDependencyCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IRealtimeNotificationSender _realtimeSender;
    private readonly ICurrentUserService _currentUserService;

    public AddTaskDependencyCommandHandler(IUnitOfWork unitOfWork, IRealtimeNotificationSender realtimeSender, ICurrentUserService currentUserService)
    {
        _unitOfWork = unitOfWork;
        _realtimeSender = realtimeSender;
        _currentUserService = currentUserService;
    }

    public async Task<ApiResponse> Handle(AddTaskDependencyCommand request, CancellationToken ct)
    {
        var task = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Include(t => t.Phase)
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        if (_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.SiteEngineer))
        {
            var currentUserId = _currentUserService.GetRequiredUserId();
            var isProjectLeader = await _unitOfWork.Repository<ProjectMember>().AnyAsync(
                member => member.ProjectId == task.Phase.ProjectId && member.UserId == currentUserId && member.IsLeader,
                ct);
            if (!isProjectLeader)
                throw new ForbiddenException("Chỉ Trưởng dự án mới được thêm liên kết phụ thuộc.");
        }

        var predecessor = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Include(t => t.Phase)
            .FirstOrDefaultAsync(t => t.TaskId == request.PredecessorTaskId, ct);

        if (predecessor == null)
            throw new NotFoundException("PredecessorTask", request.PredecessorTaskId);

        if (request.TaskId == request.PredecessorTaskId)
            throw new BusinessException("ERR_DEPENDENCY_SELF", "Một công việc không thể phụ thuộc vào chính nó.");

        // Kiểm tra xem predecessor có phải là tổ tiên (ancestor) của task hiện tại không
        var currentParentId = task.ParentTaskId;
        while (currentParentId.HasValue)
        {
            if (currentParentId.Value == request.PredecessorTaskId)
            {
                throw new BusinessException("ERR_DEPENDENCY_PARENT", "Một công việc con không thể phụ thuộc vào công việc cha/tổ tiên của nó để tránh vòng lặp khóa tiến độ.");
            }
            var parent = await _unitOfWork.Repository<ProjectTask>()
                .Query()
                .Select(t => new { t.TaskId, t.ParentTaskId })
                .FirstOrDefaultAsync(t => t.TaskId == currentParentId.Value, ct);
            currentParentId = parent?.ParentTaskId;
        }

        // Kiểm tra xem predecessor có phải là con cháu (descendant) của task hiện tại không
        var currentChildParentId = predecessor.ParentTaskId;
        while (currentChildParentId.HasValue)
        {
            if (currentChildParentId.Value == request.TaskId)
            {
                throw new BusinessException("ERR_DEPENDENCY_CHILD", "Một công việc cha không thể phụ thuộc vào công việc con/cháu của nó để tránh vòng lặp khóa tiến độ.");
            }
            var parent = await _unitOfWork.Repository<ProjectTask>()
                .Query()
                .Select(t => new { t.TaskId, t.ParentTaskId })
                .FirstOrDefaultAsync(t => t.TaskId == currentChildParentId.Value, ct);
            currentChildParentId = parent?.ParentTaskId;
        }

        if (task.PhaseId != predecessor.PhaseId)
            throw new BusinessException("ERR_DEPENDENCY_DIFFERENT_PHASES", "Hai công việc phải thuộc cùng một giai đoạn.");

        // Check if dependency already exists
        var existing = await _unitOfWork.Repository<TaskDependency>()
            .Query()
            .FirstOrDefaultAsync(d => d.TaskId == request.TaskId && d.PredecessorTaskId == request.PredecessorTaskId, ct);
        if (existing != null)
            return ApiResponse.SuccessResult("Liên kết phụ thuộc đã tồn tại.");

        // Circular Dependency Validation
        var projectId = task.Phase.ProjectId;
        var allDeps = await _unitOfWork.Repository<TaskDependency>()
            .Query()
            .Where(d => d.Task.Phase.ProjectId == projectId)
            .ToListAsync(ct);

        var visited = new HashSet<long>();
        var queue = new Queue<long>();
        queue.Enqueue(request.PredecessorTaskId);
        visited.Add(request.PredecessorTaskId);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (current == request.TaskId)
            {
                throw new BusinessException("ERR_CIRCULAR_DEPENDENCY",
                    "Không thể tạo liên kết vì sẽ gây ra vòng lặp phụ thuộc chu kỳ (Ví dụ: A phụ thuộc B và B phụ thuộc A).");
            }

            var nextNodes = allDeps.Where(d => d.TaskId == current).Select(d => d.PredecessorTaskId);
            foreach (var next in nextNodes)
            {
                if (!visited.Contains(next))
                {
                    visited.Add(next);
                    queue.Enqueue(next);
                }
            }
        }

        // Save new dependency
        var newDep = new TaskDependency
        {
            TaskId = request.TaskId,
            PredecessorTaskId = request.PredecessorTaskId,
            Task = task,
            Predecessor = predecessor
        };

        await _unitOfWork.Repository<TaskDependency>().AddAsync(newDep, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        // Trigger realtime WBS Tree update
        await _realtimeSender.SendToGroupAsync($"Project_{task.Phase.ProjectId}", "WbsTreeUpdated", new { TaskId = task.TaskId }, ct);

        return ApiResponse.SuccessResult("Thêm liên kết phụ thuộc thành công.");
    }
}
