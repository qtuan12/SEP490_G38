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
            throw new BusinessException("ERR_INCIDENT_ALREADY_CONFIRMED", "Sự cố này đã được xác nhận.");
        }

        var isEmergencyState = incident.Status == "WaitingStopApproval" || 
                              incident.Status == "WaitingRecoveryPlan" || 
                              incident.Status == "WaitingDirectorApproval";

        if (isEmergencyState)
        {
            if (incident.Status == "WaitingStopApproval")
            {
                if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager))
                    throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền phê duyệt dừng thi công.");

                var currentUser = await _unitOfWork.Repository<User>().GetByIdAsync(currentUserId, cancellationToken);
                var currentUserName = currentUser?.FullName ?? "Hệ thống";
                var newReason = "Tạm dừng thi công do sự cố đặc biệt nghiêm trọng: " + incident.Description;

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
                    if (incident.Task.ProgressPercent < 100 && incident.Task.Status == "Done")
                    {
                        incident.Task.Status = "InProgress";
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
                    if (!_currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.Accountant))
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
                    if (!_currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.Director))
                        throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền phê duyệt sự cố vật tư.");

                    incident.Status = "Approved";
                    incident.ReviewedBy = currentUserId;
                    if (!string.IsNullOrWhiteSpace(request.HandlingInstruction))
                    {
                        incident.HandlingInstruction = request.HandlingInstruction;
                    }

                    // Tìm phiếu giảm tồn kho liên kết đang chờ duyệt
                    var adjustment = await _unitOfWork.Repository<InventoryAdjustment>().Query()
                        .Include(a => a.Items)
                        .Where(a => a.ProjectId == incident.ProjectId && a.PhaseId == incident.PhaseId && a.Status == InventoryAdjustmentStatus.Pending)
                        .OrderBy(a => a.AdjustmentId)
                        .FirstOrDefaultAsync(cancellationToken);

                    if (adjustment != null)
                    {
                        // Phê duyệt phiếu giảm tồn kho
                        adjustment.Status = InventoryAdjustmentStatus.Approved;
                        adjustment.ApprovedBy = currentUserId;
                        adjustment.ApprovedAt = System.DateTime.UtcNow;
                        _unitOfWork.Repository<InventoryAdjustment>().Update(adjustment);

                        // Trừ kho và ghi log Thẻ kho (InventoryTransaction) cho từng vật tư
                        foreach (var item in adjustment.Items)
                        {
                            var currentInventory = await _unitOfWork.Repository<CurrentInventory>()
                                .FirstOrDefaultAsync(x => x.ProjectId == adjustment.ProjectId && x.MaterialId == item.MaterialId, cancellationToken);

                            if (currentInventory == null || currentInventory.Quantity < item.Quantity)
                            {
                                throw new BusinessException("ERR_INSUFFICIENT_STOCK", $"Không đủ tồn kho cho vật tư ID {item.MaterialId}");
                            }

                            currentInventory.Quantity -= item.Quantity;
                            currentInventory.LastUpdated = System.DateTime.UtcNow;
                            _unitOfWork.Repository<CurrentInventory>().Update(currentInventory);

                            var transaction = new InventoryTransaction
                            {
                                ProjectId = adjustment.ProjectId,
                                MaterialId = item.MaterialId,
                                TransactionType = 9, // IncidentLoss (Giảm tồn do sự cố)
                                QuantityChange = -item.Quantity, // Âm
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

        return ApiResponse<IncidentDto>.SuccessResult(_mapper.Map<IncidentDto>(updatedIncident), "Sự cố đã được xác nhận và xử lý.");
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
                    User = "Hệ thống"
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



