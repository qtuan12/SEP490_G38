using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Tasks.Commands.DeleteTask;

public record DeleteTaskCommand(long TaskId) : IRequest<ApiResponse>;

public class DeleteTaskCommandHandler : IRequestHandler<DeleteTaskCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteTaskCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse> Handle(DeleteTaskCommand request, CancellationToken ct)
    {
        var task = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Include(t => t.SubTasks)
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        if (task.ProgressPercent > 0)
        {
            throw new BusinessException("ERR_TASK_IN_PROGRESS", "Không thể xóa task đã có tiến độ thực hiện (> 0%).");
        }

        // Soft delete subtasks also recursively? The requirement doesn't specify deeply nested tasks, but let's delete subtasks
        foreach (var subTask in task.SubTasks)
        {
            if (subTask.ProgressPercent > 0)
                throw new BusinessException("ERR_SUBTASK_IN_PROGRESS", "Không thể xóa task vì có task con đã có tiến độ (> 0%).");
            
            _unitOfWork.Repository<ProjectTask>().Remove(subTask);
        }

        _unitOfWork.Repository<ProjectTask>().Remove(task);
        await _unitOfWork.SaveChangesAsync(ct);

        return ApiResponse.SuccessResult("Xóa task thành công.");
    }
}
