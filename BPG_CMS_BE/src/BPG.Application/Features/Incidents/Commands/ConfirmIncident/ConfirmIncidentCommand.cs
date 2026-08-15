using BPG.Domain.Common;
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
    long? ReworkAssigneeId,
    int? DecreaseProgressTo,
    string? DecreaseProgressReason,
    string? HandlingInstruction,
    string? RecoveryPlanText = null,
    decimal? RecoveryEstimateCost = null,
    string? Decision = null
) : IRequest<ApiResponse<IncidentDto>>
{
}

public class ConfirmIncidentCommandValidator : AbstractValidator<ConfirmIncidentCommand>
{
    public ConfirmIncidentCommandValidator()
    {
        RuleFor(v => v.IncidentId).GreaterThan(0).WithMessage("IncidentId is required.");
        
        When(v => v.CreateReworkTask, () => {
            RuleFor(v => v.ReworkTaskName).NotEmpty().WithMessage("ReworkTaskName is required when creating a rework task.");
            RuleFor(v => v.ReworkTaskStartDate).NotNull().WithMessage("ReworkTaskStartDate is required when creating a rework task.");
            RuleFor(v => v.ReworkTaskEndDate).NotNull().WithMessage("ReworkTaskEndDate is required when creating a rework task.");
            RuleFor(v => v.ReworkAssigneeId).NotNull().WithMessage("ReworkAssigneeId is required when creating a rework task.");
            RuleFor(v => v.ReworkTaskEndDate)
                .Must((command, endDate) =>
                    !command.ReworkTaskStartDate.HasValue
                    || !endDate.HasValue
                    || endDate.Value.Date >= command.ReworkTaskStartDate.Value.Date)
                .When(v => v.ReworkTaskStartDate.HasValue && v.ReworkTaskEndDate.HasValue)
                .WithMessage("ReworkTaskEndDate must be on or after the calendar date of ReworkTaskStartDate.");
        }).Otherwise(() => {
            RuleFor(v => v.DecreaseProgressTo)
                .GreaterThanOrEqualTo(0).LessThanOrEqualTo(100)
                .When(v => v.DecreaseProgressTo.HasValue)
                .WithMessage("DecreaseProgressTo must be between 0 and 100.");
        });

        RuleFor(v => v.Decision)
            .Must(decision => decision is null or "Approve" or "Resubmit")
            .WithMessage("Decision must be either Approve or Resubmit.");
    }
}

public class ConfirmIncidentCommandHandler : IRequestHandler<ConfirmIncidentCommand, ApiResponse<IncidentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ICurrentUserService _currentUserService;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotificationSender _realtimeSender;

    public ConfirmIncidentCommandHandler(
        IUnitOfWork unitOfWork,
        IMapper mapper,
        ICurrentUserService currentUserService,
        INotificationService notificationService,
        IRealtimeNotificationSender realtimeSender)
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
            .Include(i => i.Project)
            .FirstOrDefaultAsync(i => i.IncidentId == request.IncidentId, cancellationToken);

        if (incident == null)
        {
            throw new NotFoundException(nameof(Incident), request.IncidentId);
        }

        if (incident.Status == "Approved" || incident.Status == "Rejected")
        {
            throw new BusinessException("ERR_INCIDENT_ALREADY_CONFIRMED", "Sự cố này đã được xác nhận.");
        }

        var isEmergencyState = incident.IsEmergency;

        ValidateTransitionAndPermission(incident, request);
        await ValidateReworkAssigneeAsync(incident, request, cancellationToken);

        if (isEmergencyState)
        {
            if (incident.Status == "WaitingStopApproval")
            {
                if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager))
                    throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền phê duyệt dừng thi công.");

                if (incident.Project.Status != ProjectStatus.InProgress)
                    throw new BusinessException(
                        "ERR_PROJECT_STATE_CHANGED",
                        "Dự án không còn ở trạng thái đang thực hiện. Vui lòng tải lại dữ liệu trước khi xử lý sự cố.");

                var currentUser = await _unitOfWork.Repository<User>().GetByIdAsync(currentUserId, cancellationToken);
                var currentUserName = currentUser?.FullName ?? "Hệ thống";
                var newReason = "Tạm dừng thi công do sự cố đặc biệt nghiêm trọng: " + incident.Description;

                incident.Project.Status = ProjectStatus.Paused;
                incident.Project.PauseReason = AppendStatusHistory(
                    incident.Project.PauseReason,
                    "pause",
                    newReason,
                    DateTime.UtcNow,
                    currentUserName,
                    incident.IncidentId);
                incident.Project.PausedAt = DateTime.UtcNow;
                _unitOfWork.Repository<Project>().Update(incident.Project);

                incident.Status = "WaitingRecoveryPlan";
                incident.ReviewedBy = currentUserId;
                if (!string.IsNullOrWhiteSpace(request.HandlingInstruction))
                {
                    incident.HandlingInstruction = request.HandlingInstruction;
                }

                await SaveIncidentDecisionAsync(cancellationToken);

                await _notificationService.SendNotificationAsync(
                    incident.ReportedBy,
                    "Yêu cầu tạm dừng dự án đã được phê duyệt",
                    $"Yêu cầu tạm dừng dự án {incident.Project.Name} do sự cố khẩn cấp đã được duyệt. Dự án đã chuyển sang trạng thái Tạm dừng thi công.",
                    "IncidentAssessed",
                    $"/projects/{incident.ProjectId}/workspace/incidents"
                );

                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.TechnicalManager,
                    "Cần lập kế hoạch khắc phục sự cố",
                    $"Dự án {incident.Project.Name} đang tạm dừng thi công. Vui lòng lập báo cáo kế hoạch khắc phục.",
                    "IncidentAssessed",
                    $"/projects/{incident.ProjectId}/workspace/incidents"
                );

                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.Director,
                    "Dự án đã tạm dừng thi công",
                    $"Dự án {incident.Project.Name} đã chính thức tạm dừng thi công do sự cố khẩn cấp. Đang chờ TPKT nộp phương án khắc phục.",
                    "IncidentAssessed",
                    $"/projects/{incident.ProjectId}/workspace/incidents"
                );

                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.Accountant,
                    "Dự án đã tạm dừng thi công",
                    $"Dự án {incident.Project.Name} đã chính thức tạm dừng thi công do sự cố khẩn cấp.",
                    "IncidentAssessed",
                    $"/projects/{incident.ProjectId}/workspace/incidents"
                );

                // Notify all project members
                var projectMembers = await _unitOfWork.Repository<ProjectMember>()
                    .Query()
                    .Where(pm => pm.ProjectId == incident.ProjectId)
                    .ToListAsync(cancellationToken);

                foreach (var pm in projectMembers)
                {
                    if (pm.UserId != currentUserId)
                    {
                        await _notificationService.SendNotificationAsync(
                            pm.UserId,
                            "Dự án tạm dừng thi công",
                            $"Dự án {incident.Project.Name} đã chính thức tạm dừng thi công do sự cố khẩn cấp.",
                            "IncidentAssessed",
                            $"/projects/{incident.ProjectId}/workspace/incidents"
                        );
                    }
                }
            }
            else if (incident.Status == "WaitingRecoveryPlan")
            {
                if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager))
                    throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền nộp kế hoạch khắc phục.");

                if (string.IsNullOrWhiteSpace(request.RecoveryPlanText))
                    throw new BusinessException("ERR_INVALID_INPUT", "Nội dung báo cáo kế hoạch khắc phục không được để trống.");

                incident.RecoveryPlanText = request.RecoveryPlanText;
                incident.RecoveryEstimateCost = request.RecoveryEstimateCost;
                incident.Status = "WaitingDirectorApproval";
                if (!string.IsNullOrWhiteSpace(request.HandlingInstruction))
                {
                    incident.HandlingInstruction = request.HandlingInstruction;
                }

                await SaveIncidentDecisionAsync(cancellationToken);

                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.Director,
                    "Kế hoạch khắc phục sự cố cần phê duyệt",
                    $"TP Kỹ thuật đã nộp báo cáo và kế hoạch khắc phục cho dự án {incident.Project.Name}. Vui lòng phê duyệt.",
                    "IncidentAssessed",
                    $"/projects/{incident.ProjectId}/workspace/incidents"
                );
            }
            else if (incident.Status == "WaitingDirectorApproval")
            {
                if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.Director))
                    throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền phê duyệt kế hoạch khắc phục.");

                if (request.Decision == "Resubmit")
                {
                    incident.Status = "WaitingRecoveryPlan";
                    incident.HandlingInstruction = request.HandlingInstruction;

                    await SaveIncidentDecisionAsync(cancellationToken);

                    await _notificationService.SendNotificationToRoleAsync(
                        BPG.Domain.Constants.UserRole.TechnicalManager,
                        "Yêu cầu làm lại báo cáo kế hoạch khắc phục",
                        $"Giám đốc yêu cầu chỉnh sửa lại báo cáo kế hoạch khắc phục sự cố tại dự án {incident.Project.Name}.",
                        "IncidentRejected",
                        $"/projects/{incident.ProjectId}/workspace/incidents"
                    );
                }
                else
                {
                    // Obsolete all unfinished tasks in the project
                    var unfinishedTasks = await _unitOfWork.Repository<ProjectTask>()
                        .Query()
                        .Include(t => t.Phase)
                        .Where(t => t.Phase.ProjectId == incident.ProjectId && t.ProgressPercent < 100 && t.Status != "Obsolete")
                        .ToListAsync(cancellationToken);

                    foreach (var task in unfinishedTasks)
                    {
                        task.Status = "Obsolete";
                        task.ObsoleteReason = $"Tự động hủy (Obsolete) do Sự cố khẩn cấp của dự án: {incident.Description}";
                        _unitOfWork.Repository<ProjectTask>().Update(task);

                        var taskLog = new TaskProgressLog
                        {
                            TaskId = task.TaskId,
                            OldProgress = task.ProgressPercent,
                            NewProgress = task.ProgressPercent,
                            UpdateReason = "Task bị đánh dấu Hủy (Obsolete) do Sự cố đặc biệt nghiêm trọng của dự án: " + incident.Description,
                            UpdatedAt = DateTime.UtcNow
                        };
                        await _unitOfWork.Repository<TaskProgressLog>().AddAsync(taskLog);
                    }

                    if (request.CreateReworkTask)
                    {
                        if (incident.Task == null)
                        {
                            throw new BusinessException("ERR_NO_TASK", "Sự cố không gắn với task nào để làm lại.");
                        }

                        incident.Task.Status = "Obsolete";
                        incident.Task.ObsoleteReason = $"Tự động hủy (Obsolete) do Sự cố: {incident.Description}";
                        var log = new TaskProgressLog
                        {
                            TaskId = incident.Task.TaskId,
                            OldProgress = incident.Task.ProgressPercent,
                            NewProgress = incident.Task.ProgressPercent,
                            UpdateReason = "Task bị đánh dấu Hủy (Obsolete) do Sự cố: " + incident.Description,
                            UpdatedAt = DateTime.UtcNow
                        };
                        await _unitOfWork.Repository<TaskProgressLog>().AddAsync(log);

                        var reworkTask = new ProjectTask
                        {
                            PhaseId = incident.Task.PhaseId,
                            ParentTaskId = incident.Task.ParentTaskId,
                            IncidentId = incident.IncidentId,
                            Name = request.ReworkTaskName!,
                            Description = FormatReworkTaskDescription(incident.Description),
                            StartDate = DateOnly.FromDateTime(request.ReworkTaskStartDate!.Value),
                            EndDate = DateOnly.FromDateTime(request.ReworkTaskEndDate!.Value),
                            Status = "New",
                            ProgressPercent = 0,
                            CreatedBy = currentUserId,
                            CreatedAt = DateTime.UtcNow
                        };
                        if (request.ReworkAssigneeId.HasValue)
                        {
                            reworkTask.Assignees.Add(new TaskAssignee
                            {
                                UserId = request.ReworkAssigneeId.Value,
                                AssignedAt = DateTime.UtcNow
                            });
                        }

                        await _unitOfWork.Repository<ProjectTask>().AddAsync(reworkTask);
                        incident.ReworkTask = reworkTask;
                    }
                    else if (incident.Task != null && request.DecreaseProgressTo.HasValue)
                    {
                        if (request.DecreaseProgressTo.Value > incident.Task.ProgressPercent)
                        {
                            throw new BusinessException("ERR_INVALID_PROGRESS", "Tiến độ mới phải nhỏ hơn tiến độ hiện tại.");
                        }

                        var progressLog = new TaskProgressLog
                        {
                            TaskId = incident.Task.TaskId,
                            OldProgress = incident.Task.ProgressPercent,
                            NewProgress = (byte)request.DecreaseProgressTo.Value,
                            UpdateReason = !string.IsNullOrWhiteSpace(request.DecreaseProgressReason)
                                ? $"Phạt giảm tiến độ: {request.DecreaseProgressReason}"
                                : $"Giảm tiến độ do sự cố: {incident.Description}",
                            CreatedBy = currentUserId,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        await _unitOfWork.Repository<TaskProgressLog>().AddAsync(progressLog);

                        var dailyLog = new DailyLog
                        {
                            TaskId = incident.Task.TaskId,
                            LogDate = VietnamTime.Today,
                            NewProgressPercent = (byte)request.DecreaseProgressTo.Value,
                            Description = !string.IsNullOrWhiteSpace(request.DecreaseProgressReason)
                                ? $"Phạt giảm tiến độ: {request.DecreaseProgressReason}"
                                : $"Giảm tiến độ do sự cố: {incident.Description}",
                            CreatedBy = currentUserId,
                            CreatedAt = DateTime.UtcNow
                        };
                        await _unitOfWork.Repository<DailyLog>().AddAsync(dailyLog);

                        incident.Task.ProgressPercent = (byte)request.DecreaseProgressTo.Value;
                        if (incident.Task.ProgressPercent < 100 && incident.Task.Status == BPG.Domain.Constants.TaskStatus.Completed)
                        {
                            incident.Task.Status = BPG.Domain.Constants.TaskStatus.InProgress;
                        }
                    }

                    incident.Status = "Approved";
                    incident.ReviewedBy = currentUserId;
                    if (!string.IsNullOrWhiteSpace(request.HandlingInstruction))
                    {
                        incident.HandlingInstruction = request.HandlingInstruction;
                    }

                    await SaveIncidentDecisionAsync(cancellationToken);

                    await _notificationService.SendNotificationAsync(
                        incident.ReportedBy,
                        "Kế hoạch khắc phục sự cố đã được phê duyệt",
                        $"Báo cáo kế hoạch khắc phục sự cố tại dự án {incident.Project.Name} đã được phê duyệt. Vui lòng thiết lập Phase/Task khắc phục tại Kế hoạch thi công.",
                        "IncidentApproved",
                        $"/projects/{incident.ProjectId}/workspace/incidents"
                    );

                    await _notificationService.SendNotificationToRoleAsync(
                        BPG.Domain.Constants.UserRole.TechnicalManager,
                        "Kế hoạch khắc phục sự cố đã được phê duyệt",
                        $"Báo cáo kế hoạch khắc phục sự cố tại dự án {incident.Project.Name} đã được Giám đốc phê duyệt. Vui lòng thiết lập Phase/Task khắc phục tại Kế hoạch thi công và kích hoạt lại dự án.",
                        "IncidentApproved",
                        $"/projects/{incident.ProjectId}/workspace/incidents"
                    );
                }
            }
        }
        else
        {
            if (request.CreateReworkTask)
            {
                if (incident.Task == null)
                {
                    throw new BusinessException("ERR_NO_TASK", "Sự cố không gắn với task nào để làm lại.");
                }

                // Mark old task as Obsolete
                incident.Task.Status = "Obsolete";
                incident.Task.ObsoleteReason = $"Tự động hủy (Obsolete) do Sự cố: {incident.Description}";
                
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
                    ParentTaskId = incident.Task.ParentTaskId,
                    IncidentId = incident.IncidentId,
                    Name = request.ReworkTaskName!,
                    Description = FormatReworkTaskDescription(incident.Description),
                    StartDate = DateOnly.FromDateTime(request.ReworkTaskStartDate!.Value),
                    EndDate = DateOnly.FromDateTime(request.ReworkTaskEndDate!.Value),
                    Status = "New",
                    ProgressPercent = 0,
                    CreatedBy = currentUserId,
                    CreatedAt = DateTime.UtcNow
                };

                if (request.ReworkAssigneeId.HasValue)
                {
                    reworkTask.Assignees.Add(new TaskAssignee
                    {
                        UserId = request.ReworkAssigneeId.Value,
                        AssignedAt = DateTime.UtcNow
                    });
                }

                await _unitOfWork.Repository<ProjectTask>().AddAsync(reworkTask);
                incident.ReworkTask = reworkTask;
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
                        CreatedBy = currentUserId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    await _unitOfWork.Repository<TaskProgressLog>().AddAsync(progressLog);

                    // Also create a DailyLog so it appears on the project timeline
                    var dailyLog = new DailyLog
                    {
                        TaskId = incident.Task.TaskId,
                        LogDate = VietnamTime.Today,
                        NewProgressPercent = (byte)request.DecreaseProgressTo.Value,
                        Description = !string.IsNullOrWhiteSpace(request.DecreaseProgressReason) 
                            ? $"Phạt giảm tiến độ: {request.DecreaseProgressReason}" 
                            : $"Giảm tiến độ do sự cố: {incident.Description}",
                        CreatedBy = currentUserId,
                        CreatedAt = DateTime.UtcNow
                    };
                    await _unitOfWork.Repository<DailyLog>().AddAsync(dailyLog);

                    incident.Task.ProgressPercent = (byte)request.DecreaseProgressTo.Value;
                    if (incident.Task.ProgressPercent < 100 && incident.Task.Status == BPG.Domain.Constants.TaskStatus.Completed)
                    {
                        incident.Task.Status = BPG.Domain.Constants.TaskStatus.InProgress;
                    }
                }
            }

            var isInventoryIncident = incident.IncidentType == "InventoryLoss" || incident.IncidentType == "InventoryDamage";

            if (isInventoryIncident)
            {
                if (incident.Status == "Reported")
                {
                    // Allow the reporter (PL) or Admin to push to Accountant
                    if (incident.ReportedBy != currentUserId && !_currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin))
                        throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền chuyển báo cáo này.");

                    incident.Status = "WaitingAccountant";
                    if (!string.IsNullOrWhiteSpace(request.HandlingInstruction))
                    {
                        incident.HandlingInstruction = request.HandlingInstruction;
                    }

                    await SaveIncidentDecisionAsync(cancellationToken);

                    await _notificationService.SendNotificationToRoleAsync(
                        BPG.Domain.Constants.UserRole.Accountant,
                        "Báo cáo sự cố mới",
                        $"Có một sự cố vật tư mới tại dự án đang chờ kế toán xác minh.",
                        "IncidentReported",
                        $"/projects/{incident.ProjectId}/workspace/incidents"
                    );
                }
                else if (incident.Status == "WaitingAccountant")
                {
                    throw new BusinessException(
                        "ERR_USE_ADJUSTMENT_CREATION",
                        "Hãy tạo phiếu giảm tồn liên kết để xác minh sự cố vật tư.");
                }
                else if (incident.Status == "WaitingDirector")
                {
                    throw new BusinessException(
                        "ERR_USE_ADJUSTMENT_APPROVAL",
                        "Hãy phê duyệt phiếu giảm tồn liên kết để hoàn tất sự cố vật tư.");
                }
                else
                {
                    throw new BusinessException("ERR_INVALID_STATUS", "Sự cố vật tư không ở trạng thái có thể duyệt.");
                }
            }
            else
            {
                if (!_currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.TechnicalManager))
                    throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền phê duyệt sự cố thi công.");

                incident.Status = "Approved";
                incident.ReviewedBy = currentUserId; 
                if (!string.IsNullOrWhiteSpace(request.HandlingInstruction))
                {
                    incident.HandlingInstruction = request.HandlingInstruction;
                }

                await SaveIncidentDecisionAsync(cancellationToken);

                await _notificationService.SendNotificationAsync(
                    incident.ReportedBy,
                    "Báo cáo sự cố đã được phê duyệt",
                    $"Sự cố thi công bạn báo cáo đã được TPKT phê duyệt.",
                    "IncidentApproved",
                    $"/projects/{incident.ProjectId}/workspace/incidents"
                );
            }
        }

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

        await _realtimeSender.SendToGroupAsync(
            BPG.Domain.Constants.HubMethodNames.GroupProject + updatedIncident.ProjectId,
            BPG.Domain.Constants.HubMethodNames.ProjectUpdated,
            updatedIncident.ProjectId,
            cancellationToken);

        // Realtime: broadcast to all members viewing global incidents (Project_0)
        await _realtimeSender.SendToGroupAsync(
            BPG.Domain.Constants.HubMethodNames.GroupProject + 0,
            BPG.Domain.Constants.HubMethodNames.IncidentUpdated,
            updatedIncident.IncidentId,
            cancellationToken);

        await _realtimeSender.SendToGroupAsync(
            BPG.Domain.Constants.HubMethodNames.GroupProject + 0,
            BPG.Domain.Constants.HubMethodNames.ProjectUpdated,
            updatedIncident.ProjectId,
            cancellationToken);

        return ApiResponse<IncidentDto>.SuccessResult(_mapper.Map<IncidentDto>(updatedIncident), "Sự cố đã được xác nhận và xử lý.");
    }

    private async Task SaveIncidentDecisionAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new BusinessException(
                "ERR_INCIDENT_ALREADY_PROCESSED",
                "Sự cố hoặc trạng thái dự án đã được thay đổi bởi một phiên làm việc khác. Vui lòng tải lại dữ liệu.");
        }
    }

    private void ValidateTransitionAndPermission(Incident incident, ConfirmIncidentCommand request)
    {
        if (incident.IsEmergency)
        {
            switch (incident.Status)
            {
                case "WaitingStopApproval":
                case "WaitingRecoveryPlan":
                    if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager))
                        throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền xử lý bước này của sự cố khẩn cấp.");
                    break;

                case "WaitingDirectorApproval":
                    if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.Director))
                        throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền phê duyệt kế hoạch khắc phục.");
                    if (request.Decision is not ("Approve" or "Resubmit"))
                        throw new BusinessException("ERR_INVALID_DECISION", "Quyết định phải là Approve hoặc Resubmit.");
                    break;

                default:
                    throw new BusinessException("ERR_INVALID_STATUS", "Sự cố khẩn cấp không ở trạng thái có thể xử lý.");
            }

            return;
        }

        var isInventoryIncident = incident.IncidentType is "InventoryLoss" or "InventoryDamage";
        if (isInventoryIncident)
        {
            if (request.CreateReworkTask || request.DecreaseProgressTo.HasValue)
                throw new BusinessException("ERR_INVALID_INCIDENT_ACTION", "Sự cố vật tư không hỗ trợ thao tác làm lại hoặc giảm tiến độ.");

            var isAllowed = incident.Status switch
            {
                "Reported" => incident.ReportedBy == Convert.ToInt64(_currentUserService.UserId)
                    || _currentUserService.IsInRole(BPG.Domain.Constants.UserRole.Admin),
                "WaitingAccountant" => throw new BusinessException(
                    "ERR_USE_ADJUSTMENT_CREATION",
                    "Hãy tạo phiếu giảm tồn liên kết để xác minh sự cố vật tư."),
                "WaitingDirector" => throw new BusinessException(
                    "ERR_USE_ADJUSTMENT_APPROVAL",
                    "Hãy phê duyệt phiếu giảm tồn liên kết để hoàn tất sự cố vật tư."),
                _ => throw new BusinessException("ERR_INVALID_STATUS", "Sự cố vật tư không ở trạng thái có thể duyệt.")
            };

            if (!isAllowed)
                throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền xử lý bước này của sự cố vật tư.");

            return;
        }

        if (incident.IncidentType != "Construction" || incident.Status != "WaitingReview")
            throw new BusinessException("ERR_INVALID_STATUS", "Sự cố thi công không ở trạng thái có thể duyệt.");

        if (!_currentUserService.IsInAnyRole(
                BPG.Domain.Constants.UserRole.Admin,
                BPG.Domain.Constants.UserRole.TechnicalManager))
            throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền phê duyệt sự cố thi công.");
    }

    private async Task ValidateReworkAssigneeAsync(
        Incident incident,
        ConfirmIncidentCommand request,
        CancellationToken cancellationToken)
    {
        if (incident.Task != null)
        {
            if (incident.PhaseId.HasValue && incident.PhaseId.Value != incident.Task.PhaseId)
                throw new BusinessException("ERR_INCIDENT_TASK_PHASE_MISMATCH", "Công việc của sự cố không thuộc giai đoạn đã ghi nhận.");

            var taskBelongsToProject = await _unitOfWork.Repository<Phase>().AnyAsync(
                phase => phase.PhaseId == incident.Task.PhaseId && phase.ProjectId == incident.ProjectId,
                cancellationToken);
            if (!taskBelongsToProject)
                throw new BusinessException("ERR_INCIDENT_TASK_PROJECT_MISMATCH", "Công việc của sự cố không thuộc dự án.");
        }

        if (!request.CreateReworkTask)
            return;

        if (incident.Task == null)
            throw new BusinessException("ERR_NO_TASK", "Sự cố không gắn với task nào để làm lại.");

        if (!request.ReworkAssigneeId.HasValue)
            throw new BusinessException("ERR_INVALID_INPUT", "Người phụ trách công việc làm lại là bắt buộc.");

        var isProjectMember = await _unitOfWork.Repository<ProjectMember>().AnyAsync(
            member => member.ProjectId == incident.ProjectId
                && member.UserId == request.ReworkAssigneeId.Value,
            cancellationToken);
        if (!isProjectMember)
            throw new BusinessException(
                "ERR_TASK_ASSIGNEE_NOT_PROJECT_MEMBER",
                "Người phụ trách công việc làm lại không thuộc dự án.");
    }

    private string AppendStatusHistory(
        string? currentReason,
        string type,
        string? reason,
        DateTime timestamp,
        string userName,
        long? emergencyIncidentId = null)
    {
        List<StatusHistoryItem> historyList;
        if (!string.IsNullOrEmpty(currentReason) && currentReason.Trim().StartsWith("["))
        {
            try
            {
                historyList = System.Text.Json.JsonSerializer.Deserialize<List<StatusHistoryItem>>(currentReason) ?? new List<StatusHistoryItem>();
            }
            catch
            {
                historyList = new List<StatusHistoryItem>();
            }
        }
        else
        {
            historyList = new List<StatusHistoryItem>();
            if (!string.IsNullOrEmpty(currentReason))
            {
                historyList.Add(new StatusHistoryItem
                {
                    Type = "pause",
                    Reason = currentReason,
                    Timestamp = DateTime.UtcNow,
                    User = "Hệ thống"
                });
            }
        }

        historyList.Add(new StatusHistoryItem
        {
            Type = type,
            Reason = reason,
            Timestamp = timestamp,
            User = userName,
            EmergencyIncidentId = emergencyIncidentId
        });

        return System.Text.Json.JsonSerializer.Serialize(historyList);
    }

    private static string FormatReworkTaskDescription(string? incidentDescription)
    {
        if (string.IsNullOrWhiteSpace(incidentDescription))
        {
            return "Công việc làm lại do sự cố";
        }

        var cleanDesc = incidentDescription;
        var idx = cleanDesc.IndexOf("**Ngày/Giờ xảy ra:**", StringComparison.OrdinalIgnoreCase);
        if (idx >= 0)
        {
            cleanDesc = cleanDesc.Substring(0, idx).Trim();
        }

        cleanDesc = cleanDesc.Replace("[INC-AUDIT]", "").Replace("SEED_TEST_INVENTORY_INCIDENT", "").Trim(' ', '-', ':', '\r', '\n');

        if (string.IsNullOrWhiteSpace(cleanDesc))
        {
            return "Công việc làm lại do sự cố";
        }

        return $"Công việc làm lại do sự cố: {cleanDesc}";
    }

    private class StatusHistoryItem
    {
        public string Type { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public DateTime Timestamp { get; set; }
        public string User { get; set; } = string.Empty;
        public long? EmergencyIncidentId { get; set; }
    }
}



