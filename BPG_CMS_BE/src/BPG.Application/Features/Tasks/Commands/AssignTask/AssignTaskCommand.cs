using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Tasks.Commands.AssignTask;

public record AssignTaskCommand(long TaskId, List<long> AssigneeIds) : IRequest<ApiResponse>;

public class AssignTaskCommandHandler : IRequestHandler<AssignTaskCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationService _notificationService;

    public AssignTaskCommandHandler(IUnitOfWork unitOfWork, INotificationService notificationService)
    {
        _unitOfWork = unitOfWork;
        _notificationService = notificationService;
    }

    public async Task<ApiResponse> Handle(AssignTaskCommand request, CancellationToken ct)
    {
        var task = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Include(t => t.Assignees)
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        // Remove old assignees
        var oldAssignees = task.Assignees.ToList();
        foreach (var assignee in oldAssignees)
        {
            _unitOfWork.Repository<TaskAssignee>().Remove(assignee);
        }
        
        task.Assignees.Clear();

        // Add new assignees
        var newUsersToNotify = new List<long>();
        if (request.AssigneeIds != null && request.AssigneeIds.Any())
        {
            foreach (var userId in request.AssigneeIds.Distinct())
            {
                task.Assignees.Add(new TaskAssignee
                {
                    TaskId = task.TaskId,
                    UserId = userId,
                    AssignedAt = DateTime.UtcNow
                });
                
                if (!oldAssignees.Any(a => a.UserId == userId))
                {
                    newUsersToNotify.Add(userId);
                }
            }
            if (task.Status == BPG.Domain.Constants.TaskStatus.New)
            {
                task.Status = BPG.Domain.Constants.TaskStatus.Assigned;
            }
        }

        await _unitOfWork.SaveChangesAsync(ct);

        foreach (var userId in newUsersToNotify)
        {
            await _notificationService.SendNotificationAsync(
                userId: userId,
                title: "Bạn được phân công công việc",
                content: $"Bạn vừa được phân công vào công việc: {task.Name}.",
                notificationType: BPG.Domain.Constants.NotificationType.Progress,
                referenceType: BPG.Domain.Constants.NotificationReferenceType.Task,
                referenceId: task.TaskId,
                ct: ct);
        }

        return ApiResponse.SuccessResult("Giao việc thành công.");
    }
}
