using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Tasks.Commands.CreateTask;

public record CreateTaskCommand(
    long PhaseId,
    long? ParentTaskId,
    string Name,
    string? Description,
    int OrderIndex,
    DateOnly StartDate,
    DateOnly EndDate,
    List<long>? AssigneeIds
) : IRequest<ApiResponse<long>>;

public class CreateTaskCommandValidator : AbstractValidator<CreateTaskCommand>
{
    public CreateTaskCommandValidator()
    {
        RuleFor(x => x.PhaseId).GreaterThan(0);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.OrderIndex).GreaterThanOrEqualTo(0);
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.EndDate)
            .NotEmpty()
            .GreaterThanOrEqualTo(x => x.StartDate)
            .WithMessage("Ngày kết thúc không được nhỏ hơn ngày bắt đầu.");
    }
}

public class CreateTaskCommandHandler : IRequestHandler<CreateTaskCommand, ApiResponse<long>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationService _notificationService;

    public CreateTaskCommandHandler(IUnitOfWork unitOfWork, INotificationService notificationService)
    {
        _unitOfWork = unitOfWork;
        _notificationService = notificationService;
    }

    public async Task<ApiResponse<long>> Handle(CreateTaskCommand request, CancellationToken ct)
    {
        var phaseExists = await _unitOfWork.Repository<Phase>()
            .Query()
            .AnyAsync(p => p.PhaseId == request.PhaseId, ct);

        if (!phaseExists)
            throw new NotFoundException("Phase", request.PhaseId);

        if (request.ParentTaskId.HasValue)
        {
            var parentTask = await _unitOfWork.Repository<ProjectTask>()
                .Query()
                .FirstOrDefaultAsync(t => t.TaskId == request.ParentTaskId.Value, ct);

            if (parentTask == null)
                throw new NotFoundException("ParentTask", request.ParentTaskId.Value);

            if (request.StartDate < parentTask.StartDate || request.EndDate > parentTask.EndDate)
            {
                throw new BusinessException("ERR_TASK_DATE_INVALID", 
                    $"Thời gian task con ({request.StartDate:dd/MM/yyyy} - {request.EndDate:dd/MM/yyyy}) " +
                    $"phải nằm trong khoảng thời gian của task cha ({parentTask.StartDate:dd/MM/yyyy} - {parentTask.EndDate:dd/MM/yyyy}).");
            }
        }

        var task = new ProjectTask
        {
            PhaseId = request.PhaseId,
            ParentTaskId = request.ParentTaskId,
            Name = request.Name,
            Description = request.Description,
            OrderIndex = request.OrderIndex,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Status = BPG.Domain.Constants.TaskStatus.New,
            ProgressPercent = 0
        };

        if (request.AssigneeIds != null && request.AssigneeIds.Any())
        {
            foreach (var userId in request.AssigneeIds)
            {
                task.Assignees.Add(new TaskAssignee
                {
                    UserId = userId,
                    AssignedAt = DateTime.UtcNow
                });
            }
            task.Status = BPG.Domain.Constants.TaskStatus.Assigned;
        }

        task.ProgressLogs.Add(new TaskProgressLog
        {
            OldProgress = 0,
            NewProgress = 0,
            UpdateReason = "Khởi tạo task",
            UpdatedAt = DateTime.UtcNow
        });

        await _unitOfWork.Repository<ProjectTask>().AddAsync(task);
        await _unitOfWork.SaveChangesAsync(ct);

        if (request.AssigneeIds != null && request.AssigneeIds.Any())
        {
            foreach (var userId in request.AssigneeIds)
            {
                await _notificationService.SendNotificationAsync(
                    userId: userId,
                    title: "Bạn được giao một công việc mới",
                    content: $"Bạn đã được phân công vào công việc: {task.Name}.",
                    notificationType: BPG.Domain.Constants.NotificationType.Progress,
                    referenceType: BPG.Domain.Constants.NotificationReferenceType.Task,
                    referenceId: task.TaskId,
                    ct: ct);
            }
        }

        return ApiResponse<long>.SuccessResult(task.TaskId, "Tạo task thành công.");
    }
}
