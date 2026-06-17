using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Tasks.Commands.AdjustTaskProgress;

public record AdjustTaskProgressCommand(
    long TaskId,
    byte NewProgress,
    string UpdateReason
) : IRequest<ApiResponse>;

public class AdjustTaskProgressCommandValidator : AbstractValidator<AdjustTaskProgressCommand>
{
    public AdjustTaskProgressCommandValidator()
    {
        RuleFor(x => x.TaskId).GreaterThan(0);
        RuleFor(x => x.NewProgress).InclusiveBetween((byte)0, (byte)100);
        RuleFor(x => x.UpdateReason).NotEmpty().MaximumLength(1000);
    }
}

public class AdjustTaskProgressCommandHandler : IRequestHandler<AdjustTaskProgressCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProgressRollupService _rollupService;
    private readonly INotificationService _notificationService;

    public AdjustTaskProgressCommandHandler(IUnitOfWork unitOfWork, IProgressRollupService rollupService, INotificationService notificationService)
    {
        _unitOfWork = unitOfWork;
        _rollupService = rollupService;
        _notificationService = notificationService;
    }

    public async Task<ApiResponse> Handle(AdjustTaskProgressCommand request, CancellationToken ct)
    {
        var task = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Include(t => t.Assignees)
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        if (task.Status == BPG.Domain.Constants.TaskStatus.Obsolete)
            throw new BusinessException("ERR_TASK_OBSOLETE", "Không thể điều chỉnh tiến độ cho công việc đã báo lỗi thời.");

        var oldProgress = task.ProgressPercent;
        task.ProgressPercent = request.NewProgress;
        
        if (request.NewProgress == 100)
            task.Status = BPG.Domain.Constants.TaskStatus.Completed;
        else if (request.NewProgress > 0 && request.NewProgress < 100)
            task.Status = BPG.Domain.Constants.TaskStatus.InProgress;

        task.ProgressLogs.Add(new TaskProgressLog
        {
            OldProgress = oldProgress,
            NewProgress = request.NewProgress,
            UpdateReason = request.UpdateReason,
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
                title: "Tiến độ công việc bị điều chỉnh",
                content: $"Công việc {task.Name} đã bị điều chỉnh tiến độ thành {request.NewProgress}% với lý do: {request.UpdateReason}.",
                notificationType: BPG.Domain.Constants.NotificationType.Progress,
                referenceType: BPG.Domain.Constants.NotificationReferenceType.Task,
                referenceId: task.TaskId,
                ct: ct);
        }

        return ApiResponse.SuccessResult("Điều chỉnh tiến độ task thành công.");
    }
}
