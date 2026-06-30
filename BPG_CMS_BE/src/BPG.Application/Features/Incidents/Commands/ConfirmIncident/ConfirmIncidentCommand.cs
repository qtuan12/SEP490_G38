using BPG.Domain.Exceptions;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Incidents;
using BPG.Domain.Entities;
using BPG.Domain.Constants;
using FluentValidation;
using MediatR;
using AutoMapper;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Incidents.Commands.ConfirmIncident;

public record ConfirmIncidentCommand(
    long IncidentId,
    bool CreateReworkTask,
    string? ReworkTaskName,
    DateTime? ReworkTaskStartDate,
    DateTime? ReworkTaskEndDate,
    int? DecreaseProgressTo,
    string? DecreaseProgressReason
) : IRequest<ApiResponse<IncidentDto>>;

public class ConfirmIncidentCommandValidator : AbstractValidator<ConfirmIncidentCommand>
{
    public ConfirmIncidentCommandValidator()
    {
        RuleFor(v => v.IncidentId).GreaterThan(0).WithMessage("IncidentId is required.");
        
        When(v => v.CreateReworkTask, () => {
            RuleFor(v => v.ReworkTaskName).NotEmpty().WithMessage("ReworkTaskName is required when creating a rework task.");
            RuleFor(v => v.ReworkTaskStartDate).NotNull().WithMessage("ReworkTaskStartDate is required when creating a rework task.");
            RuleFor(v => v.ReworkTaskEndDate).NotNull().WithMessage("ReworkTaskEndDate is required when creating a rework task.");
        }).Otherwise(() => {
            RuleFor(v => v.DecreaseProgressTo).NotNull().GreaterThanOrEqualTo(0).LessThanOrEqualTo(100).WithMessage("DecreaseProgressTo is required and must be between 0 and 100 when not creating a rework task.");
        });
    }
}

public class ConfirmIncidentCommandHandler : IRequestHandler<ConfirmIncidentCommand, ApiResponse<IncidentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ICurrentUserService _currentUserService;

    public ConfirmIncidentCommandHandler(IUnitOfWork unitOfWork, IMapper mapper, ICurrentUserService currentUserService)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _currentUserService = currentUserService;
    }

    public async Task<ApiResponse<IncidentDto>> Handle(ConfirmIncidentCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = Convert.ToInt64(_currentUserService.UserId);

        var incident = await _unitOfWork.Repository<Incident>()
            .Query()
            .Include(i => i.Task)
            .FirstOrDefaultAsync(i => i.IncidentId == request.IncidentId, cancellationToken);

        if (incident == null)
        {
            throw new NotFoundException(nameof(Incident), request.IncidentId);
        }

        if (incident.Status == "Approved")
        {
            throw new BusinessException("ERR_INCIDENT_ALREADY_CONFIRMED", "Sự cố này đã được xác nhận.");
        }

        if (request.CreateReworkTask)
        {
            if (incident.Task == null)
            {
                throw new BusinessException("ERR_NO_TASK", "Sự cố không gắn với task nào để làm lại.");
            }

            // Mark old task as Obsolete
            incident.Task.Status = "Obsolete";
            
            // Log reason
            var log = new TaskProgressLog
            {
                TaskId = incident.Task.TaskId,
                OldProgress = incident.Task.ProgressPercent,
                NewProgress = incident.Task.ProgressPercent,
                UpdateReason = "Task bị đánh dấu Hủy (Obsolete) do Sự cố: " + incident.Description,
                UpdatedAt = DateTime.UtcNow
            };
            await _unitOfWork.Repository<TaskProgressLog>().AddAsync(log);

            // Create new rework task
            var reworkTask = new ProjectTask
            {
                PhaseId = incident.Task.PhaseId,
                Name = request.ReworkTaskName!,
                Description = "Rework task cho sự cố: " + incident.Description,
                StartDate = DateOnly.FromDateTime(request.ReworkTaskStartDate!.Value),
                EndDate = DateOnly.FromDateTime(request.ReworkTaskEndDate!.Value),
                Status = "New",
                ProgressPercent = 0
            };

            await _unitOfWork.Repository<ProjectTask>().AddAsync(reworkTask);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            incident.ReworkTaskId = reworkTask.TaskId;
        }
        else
        {
            if (incident.Task != null && request.DecreaseProgressTo.HasValue)
            {
                if (request.DecreaseProgressTo.Value > incident.Task.ProgressPercent)
                {
                    throw new BusinessException("ERR_INVALID_PROGRESS", "Tiến độ mới phải nhỏ hơn tiến độ hiện tại.");
                }

                // Log decrease in TaskProgressLog
                var progressLog = new TaskProgressLog
                {
                    TaskId = incident.Task.TaskId,
                    OldProgress = incident.Task.ProgressPercent,
                    NewProgress = (byte)request.DecreaseProgressTo.Value,
                    UpdateReason = !string.IsNullOrWhiteSpace(request.DecreaseProgressReason) 
                        ? $"Phạt giảm tiến độ: {request.DecreaseProgressReason}" 
                        : $"Giảm tiến độ do sự cố: {incident.Description}",
                    UpdatedAt = DateTime.UtcNow
                };
                await _unitOfWork.Repository<TaskProgressLog>().AddAsync(progressLog);

                // Also create a DailyLog so it appears on the project timeline
                var dailyLog = new DailyLog
                {
                    TaskId = incident.Task.TaskId,
                    LogDate = DateOnly.FromDateTime(DateTime.UtcNow),
                    NewProgressPercent = (byte)request.DecreaseProgressTo.Value,
                    Description = !string.IsNullOrWhiteSpace(request.DecreaseProgressReason) 
                        ? $"Phạt giảm tiến độ: {request.DecreaseProgressReason}" 
                        : $"Giảm tiến độ do sự cố: {incident.Description}",
                    CreatedBy = currentUserId,
                    CreatedAt = DateTime.UtcNow
                };
                await _unitOfWork.Repository<DailyLog>().AddAsync(dailyLog);

                incident.Task.ProgressPercent = (byte)request.DecreaseProgressTo.Value;
                if (incident.Task.ProgressPercent < 100 && incident.Task.Status == "Done")
                {
                    incident.Task.Status = "InProgress";
                }
            }
        }

        incident.Status = "Approved";
        incident.ReviewedBy = currentUserId; // TPKT confirming it

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Map and return
        var updatedIncident = await _unitOfWork.Repository<Incident>()
            .Query()
            .Include(i => i.Reporter)
            .Include(i => i.Reviewer)
            .FirstOrDefaultAsync(i => i.IncidentId == request.IncidentId, cancellationToken);

        return ApiResponse<IncidentDto>.SuccessResult(_mapper.Map<IncidentDto>(updatedIncident), "Sự cố đã được xác nhận và xử lý.");
    }
}
