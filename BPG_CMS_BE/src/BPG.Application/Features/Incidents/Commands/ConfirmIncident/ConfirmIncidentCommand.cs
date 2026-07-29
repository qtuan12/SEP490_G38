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

        if (incident.Status == "Approved")
        {
            throw new BusinessException("ERR_INCIDENT_ALREADY_CONFIRMED", "Sá»± cá»‘ nÃ y Ä‘Ã£ Ä‘Æ°á»£c xÃ¡c nháº­n.");
        }

        var isEmergencyState = incident.Status == "WaitingStopApproval" || 
                              incident.Status == "WaitingRecoveryPlan" || 
                              incident.Status == "WaitingDirectorApproval";

        if (isEmergencyState)
        {
            if (incident.Status == "WaitingStopApproval")
            {
                if (!_currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.TechnicalManager))
                    throw new BusinessException("ERR_FORBIDDEN", "Báº¡n khÃ´ng cÃ³ quyá»n phÃª duyá»‡t dá»«ng thi cÃ´ng.");

                var currentUser = await _unitOfWork.Repository<User>().GetByIdAsync(currentUserId, cancellationToken);
                var currentUserName = currentUser?.FullName ?? "Há»‡ thá»‘ng";
                var newReason = "Táº¡m dá»«ng thi cÃ´ng do sá»± cá»‘ Ä‘áº·c biá»‡t nghiÃªm trá»ng: " + incident.Description;

                incident.Project.Status = ProjectStatus.Paused;
                incident.Project.PauseReason = AppendStatusHistory(
                    incident.Project.PauseReason,
                    "pause",
                    newReason,
                    DateTime.UtcNow,
                    currentUserName);
                incident.Project.PausedAt = DateTime.UtcNow;
                _unitOfWork.Repository<Project>().Update(incident.Project);

                incident.Status = "WaitingRecoveryPlan";
                incident.ReviewedBy = currentUserId;
                if (!string.IsNullOrWhiteSpace(request.HandlingInstruction))
                {
                    incident.HandlingInstruction = request.HandlingInstruction;
                }

                await _notificationService.SendNotificationAsync(
                    incident.ReportedBy,
                    "YÃªu cáº§u táº¡m dá»«ng dá»± Ã¡n Ä‘Ã£ Ä‘Æ°á»£c phÃª duyá»‡t",
                    $"YÃªu cáº§u táº¡m dá»«ng dá»± Ã¡n {incident.Project.Name} do sá»± cá»‘ kháº©n cáº¥p Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t. Dá»± Ã¡n Ä‘Ã£ chuyá»ƒn sang tráº¡ng thÃ¡i Táº¡m dá»«ng thi cÃ´ng.",
                    "IncidentAssessed",
                    $"/projects/{incident.ProjectId}/workspace/incidents"
                );

                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.TechnicalManager,
                    "Cáº§n láº­p káº¿ hoáº¡ch kháº¯c phá»¥c sá»± cá»‘",
                    $"Dá»± Ã¡n {incident.Project.Name} Ä‘ang táº¡m dá»«ng thi cÃ´ng. Vui lÃ²ng láº­p bÃ¡o cÃ¡o káº¿ hoáº¡ch kháº¯c phá»¥c.",
                    "IncidentAssessed",
                    $"/projects/{incident.ProjectId}/workspace/incidents"
                );

                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.Director,
                    "Dá»± Ã¡n Ä‘Ã£ táº¡m dá»«ng thi cÃ´ng",
                    $"Dá»± Ã¡n {incident.Project.Name} Ä‘Ã£ chÃ­nh thá»©c táº¡m dá»«ng thi cÃ´ng do sá»± cá»‘ kháº©n cáº¥p. Äang chá» TPKT ná»™p phÆ°Æ¡ng Ã¡n kháº¯c phá»¥c.",
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
                            "Dá»± Ã¡n táº¡m dá»«ng thi cÃ´ng",
                            $"Dá»± Ã¡n {incident.Project.Name} Ä‘Ã£ chÃ­nh thá»©c táº¡m dá»«ng thi cÃ´ng do sá»± cá»‘ kháº©n cáº¥p.",
                            "IncidentAssessed",
                            $"/projects/{incident.ProjectId}/workspace/incidents"
                        );
                    }
                }
            }
            else if (incident.Status == "WaitingRecoveryPlan")
            {
                if (!_currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.TechnicalManager))
                    throw new BusinessException("ERR_FORBIDDEN", "Báº¡n khÃ´ng cÃ³ quyá»n ná»™p káº¿ hoáº¡ch kháº¯c phá»¥c.");

                if (string.IsNullOrWhiteSpace(request.RecoveryPlanText))
                    throw new BusinessException("ERR_INVALID_INPUT", "Ná»™i dung bÃ¡o cÃ¡o káº¿ hoáº¡ch kháº¯c phá»¥c khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.");

                incident.RecoveryPlanText = request.RecoveryPlanText;
                incident.RecoveryEstimateCost = request.RecoveryEstimateCost;
                incident.Status = "WaitingDirectorApproval";
                if (!string.IsNullOrWhiteSpace(request.HandlingInstruction))
                {
                    incident.HandlingInstruction = request.HandlingInstruction;
                }

                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.Director,
                    "Káº¿ hoáº¡ch kháº¯c phá»¥c sá»± cá»‘ cáº§n phÃª duyá»‡t",
                    $"TP Ká»¹ thuáº­t Ä‘Ã£ ná»™p bÃ¡o cÃ¡o vÃ  káº¿ hoáº¡ch kháº¯c phá»¥c cho dá»± Ã¡n {incident.Project.Name}. Vui lÃ²ng phÃª duyá»‡t.",
                    "IncidentAssessed",
                    $"/projects/{incident.ProjectId}/workspace/incidents"
                );
            }
            else if (incident.Status == "WaitingDirectorApproval")
            {
                if (!_currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.Director))
                    throw new BusinessException("ERR_FORBIDDEN", "Báº¡n khÃ´ng cÃ³ quyá»n phÃª duyá»‡t káº¿ hoáº¡ch kháº¯c phá»¥c.");

                if (request.Decision == "Resubmit")
                {
                    incident.Status = "WaitingRecoveryPlan";
                    incident.HandlingInstruction = request.HandlingInstruction;

                    await _notificationService.SendNotificationToRoleAsync(
                        BPG.Domain.Constants.UserRole.TechnicalManager,
                        "YÃªu cáº§u lÃ m láº¡i bÃ¡o cÃ¡o káº¿ hoáº¡ch kháº¯c phá»¥c",
                        $"GiÃ¡m Ä‘á»‘c yÃªu cáº§u chá»‰nh sá»­a láº¡i bÃ¡o cÃ¡o káº¿ hoáº¡ch kháº¯c phá»¥c sá»± cá»‘ táº¡i dá»± Ã¡n {incident.Project.Name}.",
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
                        task.ObsoleteReason = $"Tá»± Ä‘á»™ng há»§y (Obsolete) do Sá»± cá»‘ kháº©n cáº¥p cá»§a dá»± Ã¡n: {incident.Description}";
                        _unitOfWork.Repository<ProjectTask>().Update(task);

                        var taskLog = new TaskProgressLog
                        {
                            TaskId = task.TaskId,
                            OldProgress = task.ProgressPercent,
                            NewProgress = task.ProgressPercent,
                            UpdateReason = "Task bá»‹ Ä‘Ã¡nh dáº¥u Há»§y (Obsolete) do Sá»± cá»‘ Ä‘áº·c biá»‡t nghiÃªm trá»ng cá»§a dá»± Ã¡n: " + incident.Description,
                            UpdatedAt = DateTime.UtcNow
                        };
                        await _unitOfWork.Repository<TaskProgressLog>().AddAsync(taskLog);
                    }

                    if (request.CreateReworkTask)
                    {
                        if (incident.Task == null)
                        {
                            throw new BusinessException("ERR_NO_TASK", "Sá»± cá»‘ khÃ´ng gáº¯n vá»›i task nÃ o Ä‘á»ƒ lÃ m láº¡i.");
                        }

                        incident.Task.Status = "Obsolete";
                        incident.Task.ObsoleteReason = $"Tá»± Ä‘á»™ng há»§y (Obsolete) do Sá»± cá»‘: {incident.Description}";
                        var log = new TaskProgressLog
                        {
                            TaskId = incident.Task.TaskId,
                            OldProgress = incident.Task.ProgressPercent,
                            NewProgress = incident.Task.ProgressPercent,
                            UpdateReason = "Task bá»‹ Ä‘Ã¡nh dáº¥u Há»§y (Obsolete) do Sá»± cá»‘: " + incident.Description,
                            UpdatedAt = DateTime.UtcNow
                        };
                        await _unitOfWork.Repository<TaskProgressLog>().AddAsync(log);

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

                        if (request.ReworkAssigneeId.HasValue)
                        {
                            var assignee = new TaskAssignee
                            {
                                TaskId = reworkTask.TaskId,
                                UserId = request.ReworkAssigneeId.Value
                            };
                            await _unitOfWork.Repository<TaskAssignee>().AddAsync(assignee);
                            await _unitOfWork.SaveChangesAsync(cancellationToken);
                        }

                        incident.ReworkTaskId = reworkTask.TaskId;
                    }
                    else if (incident.Task != null && request.DecreaseProgressTo.HasValue)
                    {
                        if (request.DecreaseProgressTo.Value > incident.Task.ProgressPercent)
                        {
                            throw new BusinessException("ERR_INVALID_PROGRESS", "Tiáº¿n Ä‘á»™ má»›i pháº£i nhá» hÆ¡n tiáº¿n Ä‘á»™ hiá»‡n táº¡i.");
                        }

                        var progressLog = new TaskProgressLog
                        {
                            TaskId = incident.Task.TaskId,
                            OldProgress = incident.Task.ProgressPercent,
                            NewProgress = (byte)request.DecreaseProgressTo.Value,
                            UpdateReason = !string.IsNullOrWhiteSpace(request.DecreaseProgressReason)
                                ? $"Pháº¡t giáº£m tiáº¿n Ä‘á»™: {request.DecreaseProgressReason}"
                                : $"Giáº£m tiáº¿n Ä‘á»™ do sá»± cá»‘: {incident.Description}",
                            UpdatedAt = DateTime.UtcNow
                        };
                        await _unitOfWork.Repository<TaskProgressLog>().AddAsync(progressLog);

                        var dailyLog = new DailyLog
                        {
                            TaskId = incident.Task.TaskId,
                            LogDate = DateOnly.FromDateTime(DateTime.UtcNow),
                            NewProgressPercent = (byte)request.DecreaseProgressTo.Value,
                            Description = !string.IsNullOrWhiteSpace(request.DecreaseProgressReason)
                                ? $"Pháº¡t giáº£m tiáº¿n Ä‘á»™: {request.DecreaseProgressReason}"
                                : $"Giáº£m tiáº¿n Ä‘á»™ do sá»± cá»‘: {incident.Description}",
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

                    incident.Status = "Approved";
                    incident.ReviewedBy = currentUserId;
                    if (!string.IsNullOrWhiteSpace(request.HandlingInstruction))
                    {
                        incident.HandlingInstruction = request.HandlingInstruction;
                    }


                    await _notificationService.SendNotificationAsync(
                        incident.ReportedBy,
                        "Káº¿ hoáº¡ch kháº¯c phá»¥c sá»± cá»‘ Ä‘Ã£ Ä‘Æ°á»£c phÃª duyá»‡t",
                        $"BÃ¡o cÃ¡o káº¿ hoáº¡ch kháº¯c phá»¥c sá»± cá»‘ táº¡i dá»± Ã¡n {incident.Project.Name} Ä‘Ã£ Ä‘Æ°á»£c phÃª duyá»‡t. Vui lÃ²ng thiáº¿t láº­p Phase/Task kháº¯c phá»¥c táº¡i Káº¿ hoáº¡ch thi cÃ´ng.",
                        "IncidentApproved",
                        $"/projects/{incident.ProjectId}/workspace/incidents"
                    );

                    await _notificationService.SendNotificationToRoleAsync(
                        BPG.Domain.Constants.UserRole.TechnicalManager,
                        "Káº¿ hoáº¡ch kháº¯c phá»¥c sá»± cá»‘ Ä‘Ã£ Ä‘Æ°á»£c phÃª duyá»‡t",
                        $"BÃ¡o cÃ¡o káº¿ hoáº¡ch kháº¯c phá»¥c sá»± cá»‘ táº¡i dá»± Ã¡n {incident.Project.Name} Ä‘Ã£ Ä‘Æ°á»£c GiÃ¡m Ä‘á»‘c phÃª duyá»‡t. Vui lÃ²ng thiáº¿t láº­p Phase/Task kháº¯c phá»¥c táº¡i Káº¿ hoáº¡ch thi cÃ´ng vÃ  kÃ­ch hoáº¡t láº¡i dá»± Ã¡n.",
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
                    throw new BusinessException("ERR_NO_TASK", "Sá»± cá»‘ khÃ´ng gáº¯n vá»›i task nÃ o Ä‘á»ƒ lÃ m láº¡i.");
                }

                // Mark old task as Obsolete
                incident.Task.Status = "Obsolete";
                incident.Task.ObsoleteReason = $"Tá»± Ä‘á»™ng há»§y (Obsolete) do Sá»± cá»‘: {incident.Description}";
                
                // Log reason
                var log = new TaskProgressLog
                {
                    TaskId = incident.Task.TaskId,
                    OldProgress = incident.Task.ProgressPercent,
                    NewProgress = incident.Task.ProgressPercent,
                    UpdateReason = "Task bá»‹ Ä‘Ã¡nh dáº¥u Há»§y (Obsolete) do Sá»± cá»‘: " + incident.Description,
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

                if (request.ReworkAssigneeId.HasValue)
                {
                    var assignee = new TaskAssignee
                    {
                        TaskId = reworkTask.TaskId,
                        UserId = request.ReworkAssigneeId.Value
                    };
                    await _unitOfWork.Repository<TaskAssignee>().AddAsync(assignee);
                    await _unitOfWork.SaveChangesAsync(cancellationToken);
                }

                incident.ReworkTaskId = reworkTask.TaskId;
            }
            else
            {
                if (incident.Task != null && request.DecreaseProgressTo.HasValue)
                {
                    if (request.DecreaseProgressTo.Value > incident.Task.ProgressPercent)
                    {
                        throw new BusinessException("ERR_INVALID_PROGRESS", "Tiáº¿n Ä‘á»™ má»›i pháº£i nhá» hÆ¡n tiáº¿n Ä‘á»™ hiá»‡n táº¡i.");
                    }

                    // Log decrease in TaskProgressLog
                    var progressLog = new TaskProgressLog
                    {
                        TaskId = incident.Task.TaskId,
                        OldProgress = incident.Task.ProgressPercent,
                        NewProgress = (byte)request.DecreaseProgressTo.Value,
                        UpdateReason = !string.IsNullOrWhiteSpace(request.DecreaseProgressReason) 
                            ? $"Pháº¡t giáº£m tiáº¿n Ä‘á»™: {request.DecreaseProgressReason}" 
                            : $"Giáº£m tiáº¿n Ä‘á»™ do sá»± cá»‘: {incident.Description}",
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
                            ? $"Pháº¡t giáº£m tiáº¿n Ä‘á»™: {request.DecreaseProgressReason}" 
                            : $"Giáº£m tiáº¿n Ä‘á»™ do sá»± cá»‘: {incident.Description}",
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
                    if (!_currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.Accountant))
                        throw new BusinessException("ERR_FORBIDDEN", "Báº¡n khÃ´ng cÃ³ quyá»n xÃ¡c minh sá»± cá»‘ váº­t tÆ°.");
                    
                    incident.Status = "WaitingDirector";
                    if (!string.IsNullOrWhiteSpace(request.HandlingInstruction))
                    {
                        incident.HandlingInstruction = request.HandlingInstruction;
                    }

                    await _notificationService.SendNotificationToRoleAsync(
                        BPG.Domain.Constants.UserRole.Director,
                        "BÃ¡o cÃ¡o sá»± cá»‘ cáº§n phÃª duyá»‡t",
                        $"Káº¿ toÃ¡n Ä‘Ã£ xÃ¡c minh sá»± cá»‘ váº­t tÆ° táº¡i dá»± Ã¡n. Vui lÃ²ng phÃª duyá»‡t.",
                        "IncidentAssessed",
                        $"/projects/{incident.ProjectId}/workspace/incidents"
                    );
                }
                else if (incident.Status == "WaitingDirector")
                {
                    if (!_currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.Director))
                        throw new BusinessException("ERR_FORBIDDEN", "Báº¡n khÃ´ng cÃ³ quyá»n phÃª duyá»‡t sá»± cá»‘ váº­t tÆ°.");

                    incident.Status = "Approved";
                    incident.ReviewedBy = currentUserId;
                    if (!string.IsNullOrWhiteSpace(request.HandlingInstruction))
                    {
                        incident.HandlingInstruction = request.HandlingInstruction;
                    }

                    // TÃ¬m phiáº¿u giáº£m tá»“n kho liÃªn káº¿t Ä‘ang chá» duyá»‡t
                    var adjustment = await _unitOfWork.Repository<InventoryAdjustment>().Query()
                        .Include(a => a.Items)
                        .Where(a => a.ProjectId == incident.ProjectId && a.PhaseId == incident.PhaseId && a.Status == InventoryAdjustmentStatus.Pending)
                        .OrderBy(a => a.AdjustmentId)
                        .FirstOrDefaultAsync(cancellationToken);

                    if (adjustment != null)
                    {
                        // PhÃª duyá»‡t phiáº¿u giáº£m tá»“n kho
                        adjustment.Status = InventoryAdjustmentStatus.Approved;
                        adjustment.ApprovedBy = currentUserId;
                        adjustment.ApprovedAt = System.DateTime.UtcNow;
                        _unitOfWork.Repository<InventoryAdjustment>().Update(adjustment);

                        // Trá»« kho vÃ  ghi log Tháº» kho (InventoryTransaction) cho tá»«ng váº­t tÆ°
                        foreach (var item in adjustment.Items)
                        {
                            var currentInventory = await _unitOfWork.Repository<CurrentInventory>()
                                .FirstOrDefaultAsync(x => x.ProjectId == adjustment.ProjectId && x.MaterialId == item.MaterialId, cancellationToken);

                            if (currentInventory == null || currentInventory.Quantity < item.Quantity)
                            {
                                throw new BusinessException("ERR_INSUFFICIENT_STOCK", $"KhÃ´ng Ä‘á»§ tá»“n kho cho váº­t tÆ° ID {item.MaterialId}");
                            }

                            currentInventory.Quantity -= item.Quantity;
                            currentInventory.LastUpdated = System.DateTime.UtcNow;
                            _unitOfWork.Repository<CurrentInventory>().Update(currentInventory);

                            var transaction = new InventoryTransaction
                            {
                                ProjectId = adjustment.ProjectId,
                                MaterialId = item.MaterialId,
                                TransactionType = 9, // IncidentLoss (Giáº£m tá»“n do sá»± cá»‘)
                                QuantityChange = -item.Quantity, // Ã‚m
                                BalanceAfter = currentInventory.Quantity,
                                ReferenceId = adjustment.AdjustmentId,
                                ReferenceType = EntityType.InventoryAdjustment,
                                CreatedBy = currentUserId,
                                CreatedAt = System.DateTime.UtcNow
                            };
                            await _unitOfWork.Repository<InventoryTransaction>().AddAsync(transaction);
                        }
                    }

                    await _notificationService.SendNotificationAsync(
                        incident.ReportedBy,
                        "BÃ¡o cÃ¡o sá»± cá»‘ Ä‘Ã£ Ä‘Æ°á»£c phÃª duyá»‡t",
                        $"Sá»± cá»‘ váº­t tÆ° báº¡n bÃ¡o cÃ¡o Ä‘Ã£ Ä‘Æ°á»£c GiÃ¡m Ä‘á»‘c phÃª duyá»‡t.",
                        "IncidentApproved",
                        $"/projects/{incident.ProjectId}/workspace/incidents"
                    );
                }
                else
                {
                    throw new BusinessException("ERR_INVALID_STATUS", "Sá»± cá»‘ váº­t tÆ° khÃ´ng á»Ÿ tráº¡ng thÃ¡i cÃ³ thá»ƒ duyá»‡t.");
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
                    "BÃ¡o cÃ¡o sá»± cá»‘ Ä‘Ã£ Ä‘Æ°á»£c phÃª duyá»‡t",
                    $"Sá»± cá»‘ thi cÃ´ng báº¡n bÃ¡o cÃ¡o Ä‘Ã£ Ä‘Æ°á»£c TPKT phÃª duyá»‡t.",
                    "IncidentApproved",
                    $"/projects/{incident.ProjectId}/workspace/incidents"
                );
            }
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

        return ApiResponse<IncidentDto>.SuccessResult(_mapper.Map<IncidentDto>(updatedIncident), "Sá»± cá»‘ Ä‘Ã£ Ä‘Æ°á»£c xÃ¡c nháº­n vÃ  xá»­ lÃ½.");
    }

    private string AppendStatusHistory(string? currentReason, string type, string? reason, DateTime timestamp, string userName)
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
                    User = "Há»‡ thá»‘ng"
                });
            }
        }

        historyList.Add(new StatusHistoryItem
        {
            Type = type,
            Reason = reason,
            Timestamp = timestamp,
            User = userName
        });

        return System.Text.Json.JsonSerializer.Serialize(historyList);
    }

    private class StatusHistoryItem
    {
        public string Type { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public DateTime Timestamp { get; set; }
        public string User { get; set; } = string.Empty;
    }
}



