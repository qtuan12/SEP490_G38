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
    string? DecreaseProgressReason,
    string? HandlingInstruction
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
            RuleFor(v => v.DecreaseProgressTo)
                .GreaterThanOrEqualTo(0).LessThanOrEqualTo(100)
                .When(v => v.DecreaseProgressTo.HasValue)
                .WithMessage("DecreaseProgressTo must be between 0 and 100.");
        });
    }
}

public class ConfirmIncidentCommandHandler : IRequestHandler<ConfirmIncidentCommand, ApiResponse<IncidentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ICurrentUserService _currentUserService;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotificationSender _realtimeSender;

    public ConfirmIncidentCommandHandler(IUnitOfWork unitOfWork, IMapper mapper, ICurrentUserService currentUserService, INotificationService notificationService, IRealtimeNotificationSender realtimeSender)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _currentUserService = currentUserService;
        _notificationService = notificationService;
        _realtimeSender = realtimeSender;
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
                Description = string.Empty,
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

        var isInventoryIncident = incident.IncidentType == "InventoryLoss" || incident.IncidentType == "InventoryDamage";

        if (isInventoryIncident)
        {
            if (incident.Status == "WaitingAccountant")
            {
                if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.Accountant) && !_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.Admin))
                    throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền xác minh sự cố vật tư.");
                
                incident.Status = "WaitingDirector";
                if (!string.IsNullOrWhiteSpace(request.HandlingInstruction))
                {
                    incident.HandlingInstruction = request.HandlingInstruction;
                }

                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.Director,
                    "Báo cáo sự cố cần phê duyệt",
                    $"Kế toán đã xác minh sự cố vật tư tại dự án. Vui lòng phê duyệt.",
                    "IncidentAssessed",
                    $"/projects/{incident.ProjectId}/workspace/incidents"
                );
            }
            else if (incident.Status == "WaitingDirector")
            {
                if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.Director) && !_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.Admin))
                    throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền phê duyệt sự cố vật tư.");

                incident.Status = "Approved";
                incident.ReviewedBy = currentUserId;
                if (!string.IsNullOrWhiteSpace(request.HandlingInstruction))
                {
                    incident.HandlingInstruction = request.HandlingInstruction;
                }

                await _notificationService.SendNotificationAsync(
                    incident.ReportedBy,
                    "Báo cáo sự cố đã được phê duyệt",
                    $"Sự cố vật tư bạn báo cáo đã được Giám đốc phê duyệt.",
                    "IncidentApproved",
                    $"/projects/{incident.ProjectId}/workspace/incidents"
                );
            }
            else
            {
                throw new BusinessException("ERR_INVALID_STATUS", "Sự cố vật tư không ở trạng thái có thể duyệt.");
            }
        }
        else
        {
            incident.Status = "Approved";
            incident.ReviewedBy = currentUserId; 
            if (!string.IsNullOrWhiteSpace(request.HandlingInstruction))
            {
                incident.HandlingInstruction = request.HandlingInstruction;
            }

            await _notificationService.SendNotificationAsync(
                incident.ReportedBy,
                "Báo cáo sự cố đã được phê duyệt",
                $"Sự cố thi công bạn báo cáo đã được TPKT phê duyệt.",
                "IncidentApproved",
                $"/projects/{incident.ProjectId}/workspace/incidents"
            );
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Map and return
        var updatedIncident = await _unitOfWork.Repository<Incident>()
            .Query()
            .Include(i => i.Reporter)
            .Include(i => i.Reviewer)
            .FirstOrDefaultAsync(i => i.IncidentId == request.IncidentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Incident), request.IncidentId);

        // Realtime: broadcast to all members currently viewing this project
        await _realtimeSender.SendToGroupAsync(
            BPG.Domain.Constants.HubMethodNames.GroupProject + updatedIncident.ProjectId,
            BPG.Domain.Constants.HubMethodNames.IncidentUpdated,
            updatedIncident.IncidentId,
            cancellationToken);

        // Realtime: broadcast to all members viewing global incidents (Project_0)
        await _realtimeSender.SendToGroupAsync(
            BPG.Domain.Constants.HubMethodNames.GroupProject + 0,
            BPG.Domain.Constants.HubMethodNames.IncidentUpdated,
            updatedIncident.IncidentId,
            cancellationToken);

        return ApiResponse<IncidentDto>.SuccessResult(_mapper.Map<IncidentDto>(updatedIncident), "Sự cố đã được xác nhận và xử lý.");
    }
}
