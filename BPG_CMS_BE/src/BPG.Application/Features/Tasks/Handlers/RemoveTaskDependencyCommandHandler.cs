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

    public RemoveTaskDependencyCommandHandler(IUnitOfWork unitOfWork, IRealtimeNotificationSender realtimeSender)
    {
        _unitOfWork = unitOfWork;
        _realtimeSender = realtimeSender;
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
