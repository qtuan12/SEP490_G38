using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Tasks.Commands.MarkTaskObsolete;

public record MarkTaskObsoleteCommand(
    long TaskId,
    string ObsoleteReason
) : IRequest<ApiResponse>;

public class MarkTaskObsoleteCommandValidator : AbstractValidator<MarkTaskObsoleteCommand>
{
    public MarkTaskObsoleteCommandValidator()
    {
        RuleFor(x => x.TaskId).GreaterThan(0);
        RuleFor(x => x.ObsoleteReason).NotEmpty().MaximumLength(1000);
    }
}

public class MarkTaskObsoleteCommandHandler : IRequestHandler<MarkTaskObsoleteCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProgressRollupService _rollupService;
    private readonly INotificationService _notificationService;

    public MarkTaskObsoleteCommandHandler(IUnitOfWork unitOfWork, IProgressRollupService rollupService, INotificationService notificationService)
    {
        _unitOfWork = unitOfWork;
        _rollupService = rollupService;
        _notificationService = notificationService;
    }

    public async Task<ApiResponse> Handle(MarkTaskObsoleteCommand request, CancellationToken ct)
    {
        var task = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Include(t => t.Assignees)
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        if (task.Status == BPG.Domain.Constants.TaskStatus.Obsolete)
            return ApiResponse.SuccessResult("Task đã ở trạng thái Obsolete.");

        task.Status = BPG.Domain.Constants.TaskStatus.Obsolete;
        task.ObsoleteReason = request.ObsoleteReason;

        _unitOfWork.Repository<ProjectTask>().Update(task);
        await _unitOfWork.SaveChangesAsync(ct);

        // Cuộn tiến độ (sẽ bỏ qua task này vì đã obsolete)
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
                title: "Công việc bị hủy bỏ",
                content: $"Công việc {task.Name} đã được đánh dấu là lỗi thời/bị hủy bỏ do: {request.ObsoleteReason}.",
                notificationType: BPG.Domain.Constants.NotificationType.System,
                referenceType: BPG.Domain.Constants.NotificationReferenceType.Task,
                referenceId: task.TaskId,
                ct: ct);
        }

        return ApiResponse.SuccessResult("Đánh dấu task lỗi thời thành công.");
    }
}
