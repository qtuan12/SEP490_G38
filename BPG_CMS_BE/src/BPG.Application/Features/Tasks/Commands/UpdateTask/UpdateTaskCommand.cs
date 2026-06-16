using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Tasks.Commands.UpdateTask;

public record UpdateTaskCommand(
    long TaskId,
    string Name,
    string? Description,
    int OrderIndex,
    DateOnly StartDate,
    DateOnly EndDate,
    string? UpdateReason
) : IRequest<ApiResponse>;

public class UpdateTaskCommandValidator : AbstractValidator<UpdateTaskCommand>
{
    public UpdateTaskCommandValidator()
    {
        RuleFor(x => x.TaskId).GreaterThan(0);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.OrderIndex).GreaterThanOrEqualTo(0);
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.EndDate)
            .NotEmpty()
            .GreaterThanOrEqualTo(x => x.StartDate)
            .WithMessage("Ngày kết thúc không được nhỏ hơn ngày bắt đầu.");
    }
}

public class UpdateTaskCommandHandler : IRequestHandler<UpdateTaskCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateTaskCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse> Handle(UpdateTaskCommand request, CancellationToken ct)
    {
        var task = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        // Check date constraints with parent
        if (task.ParentTaskId.HasValue)
        {
            var parentTask = await _unitOfWork.Repository<ProjectTask>()
                .Query()
                .FirstOrDefaultAsync(t => t.TaskId == task.ParentTaskId.Value, ct);

            if (parentTask != null && (request.StartDate < parentTask.StartDate || request.EndDate > parentTask.EndDate))
            {
                throw new BusinessException("ERR_TASK_DATE_INVALID", 
                    $"Thời gian task con ({request.StartDate:dd/MM/yyyy} - {request.EndDate:dd/MM/yyyy}) " +
                    $"phải nằm trong khoảng thời gian của task cha ({parentTask.StartDate:dd/MM/yyyy} - {parentTask.EndDate:dd/MM/yyyy}).");
            }
        }

        // Require reason if progress > 0% and changing content/date
        bool isContentOrDateChanged = task.Name != request.Name 
                                      || task.Description != request.Description 
                                      || task.StartDate != request.StartDate 
                                      || task.EndDate != request.EndDate;

        if (task.ProgressPercent > 0 && isContentOrDateChanged)
        {
            if (string.IsNullOrWhiteSpace(request.UpdateReason))
            {
                throw new BusinessException("ERR_TASK_UPDATE_REASON_REQUIRED", "Cần có lý do cập nhật khi sửa task đang thực hiện (> 0%).");
            }

            task.ProgressLogs.Add(new TaskProgressLog
            {
                OldProgress = task.ProgressPercent,
                NewProgress = task.ProgressPercent,
                UpdateReason = $"Sửa thông tin task: {request.UpdateReason}",
                UpdatedAt = DateTime.UtcNow
            });
        }

        task.Name = request.Name;
        task.Description = request.Description;
        task.OrderIndex = request.OrderIndex;
        task.StartDate = request.StartDate;
        task.EndDate = request.EndDate;

        _unitOfWork.Repository<ProjectTask>().Update(task);
        await _unitOfWork.SaveChangesAsync(ct);

        return ApiResponse.SuccessResult("Cập nhật task thành công.");
    }
}
