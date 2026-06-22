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

    public AddTaskDependencyCommandHandler(IUnitOfWork unitOfWork, IRealtimeNotificationSender realtimeSender)
    {
        _unitOfWork = unitOfWork;
        _realtimeSender = realtimeSender;
    }

    public async Task<ApiResponse> Handle(AddTaskDependencyCommand request, CancellationToken ct)
    {
        var task = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Include(t => t.Phase)
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        var predecessor = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Include(t => t.Phase)
            .FirstOrDefaultAsync(t => t.TaskId == request.PredecessorTaskId, ct);

        if (predecessor == null)
            throw new NotFoundException("PredecessorTask", request.PredecessorTaskId);

        if (request.TaskId == request.PredecessorTaskId)
            throw new BusinessException("ERR_DEPENDENCY_SELF", "Một công việc không thể phụ thuộc vào chính nó.");

        if (task.Phase.ProjectId != predecessor.Phase.ProjectId)
            throw new BusinessException("ERR_DEPENDENCY_DIFFERENT_PROJECTS", "Hai công việc phải thuộc cùng một dự án.");

        // Check if dependency already exists
        var existing = await _unitOfWork.Repository<TaskDependency>()
            .Query()
            .FirstOrDefaultAsync(d => d.TaskId == request.TaskId && d.PredecessorTaskId == request.PredecessorTaskId, ct);
        if (existing != null)
            return ApiResponse.SuccessResult("Liên kết phụ thuộc đã tồn tại.");

        // Circular Dependency Validation
        var allDeps = await _unitOfWork.Repository<TaskDependency>()
            .Query()
            .Where(d => d.Task.Phase.ProjectId == task.Phase.ProjectId)
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
            PredecessorTaskId = request.PredecessorTaskId
        };

        await _unitOfWork.Repository<TaskDependency>().AddAsync(newDep, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        // Trigger realtime WBS Tree update
        await _realtimeSender.SendToGroupAsync($"Project_{task.Phase.ProjectId}", "WbsTreeUpdated", new { TaskId = task.TaskId }, ct);

        return ApiResponse.SuccessResult("Thêm liên kết phụ thuộc thành công.");
    }
}
