using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BPG.Application.Features.Tasks.Commands;

namespace BPG.Application.Features.Tasks.Handlers;

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
            .Include(t => t.Phase)
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        var distinctAssigneeIds = request.AssigneeIds?
            .Distinct()
            .ToList() ?? new List<long>();

        if (distinctAssigneeIds.Count > 0)
        {
            var projectMemberUserIds = await _unitOfWork.Repository<ProjectMember>()
                .Query()
                .Where(pm => pm.ProjectId == task.Phase.ProjectId && distinctAssigneeIds.Contains(pm.UserId))
                .Select(pm => pm.UserId)
                .Distinct()
                .ToListAsync(ct);

            var invalidAssigneeIds = distinctAssigneeIds
                .Except(projectMemberUserIds)
                .OrderBy(userId => userId)
                .ToList();

            if (invalidAssigneeIds.Count > 0)
            {
                throw new BusinessException(
                    "ERR_TASK_ASSIGNEE_NOT_PROJECT_MEMBER",
                    $"Không thể phân công công việc vì người dùng có ID [{string.Join(", ", invalidAssigneeIds)}] không thuộc dự án.");
            }
        }

        // Remove old assignees
        var oldAssignees = task.Assignees.ToList();
        foreach (var assignee in oldAssignees)
        {
            _unitOfWork.Repository<TaskAssignee>().Remove(assignee);
        }
        
        task.Assignees.Clear();

        // Add new assignees
        var newUsersToNotify = new List<long>();
        if (distinctAssigneeIds.Count > 0)
        {
            foreach (var userId in distinctAssigneeIds)
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
