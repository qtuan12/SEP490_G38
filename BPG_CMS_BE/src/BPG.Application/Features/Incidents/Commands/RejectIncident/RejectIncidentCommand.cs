using BPG.Application.Common.Models;
using BPG.Application.DTOs.Incidents;
using BPG.Application.Features.InventoryAdjustments.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using BPG.Domain.Constants;
using FluentValidation;
using MediatR;
using AutoMapper;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Incidents.Commands.RejectIncident;

public record RejectIncidentCommand(long IncidentId, string Reason)
    : IRequest<ApiResponse<IncidentDto>>
{
}

public class RejectIncidentCommandValidator : AbstractValidator<RejectIncidentCommand>
{
    public RejectIncidentCommandValidator()
    {
        RuleFor(v => v.IncidentId).GreaterThan(0);
        RuleFor(v => v.Reason).NotEmpty().WithMessage("Lý do từ chối là bắt buộc.");
    }
}

public class RejectIncidentCommandHandler : IRequestHandler<RejectIncidentCommand, ApiResponse<IncidentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ICurrentUserService _currentUserService;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotificationSender _realtimeSender;

    public RejectIncidentCommandHandler(IUnitOfWork unitOfWork, IMapper mapper, ICurrentUserService currentUserService, INotificationService notificationService, IRealtimeNotificationSender realtimeSender)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _currentUserService = currentUserService;
        _notificationService = notificationService;
        _realtimeSender = realtimeSender;
    }

    public async Task<ApiResponse<IncidentDto>> Handle(RejectIncidentCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = Convert.ToInt64(_currentUserService.UserId);

        var incident = await _unitOfWork.Repository<Incident>()
            .Query()
            .Include(i => i.Project)
            .FirstOrDefaultAsync(i => i.IncidentId == request.IncidentId, cancellationToken);

        if (incident == null)
            throw new NotFoundException(nameof(Incident), request.IncidentId);

        if (incident.Status == "Approved" || incident.Status == "Rejected")
            throw new BusinessException("ERR_INCIDENT_ALREADY_PROCESSED", "Sự cố này đã được xử lý.");

        ValidateTransitionAndPermission(incident, currentUserId);

        incident.Status = "Rejected";
        incident.ReviewedBy = currentUserId;
        incident.HandlingInstruction = request.Reason; // Lưu lý do vào HandlingInstruction

        if (incident.IsEmergency
            && incident.Project != null
            && incident.Project.Status == ProjectStatus.Paused
            && WasProjectPausedByIncident(incident.Project.PauseReason, incident.IncidentId))
        {
            var otherEmergencyIncidents = await _unitOfWork.Repository<Incident>()
                .Query()
                .AnyAsync(i => i.ProjectId == incident.ProjectId 
                    && i.IncidentId != incident.IncidentId
                    && i.IsEmergency 
                    && (i.Status == "WaitingStopApproval" || i.Status == "WaitingRecoveryPlan" || i.Status == "WaitingDirectorApproval"), cancellationToken);

            if (!otherEmergencyIncidents)
            {
                var currentUser = await _unitOfWork.Repository<User>().GetByIdAsync(currentUserId, cancellationToken);
                var currentUserName = currentUser?.FullName ?? "Hệ thống";

                incident.Project.Status = ProjectStatus.InProgress;
                incident.Project.PauseReason = AppendStatusHistory(
                    incident.Project.PauseReason,
                    "resume",
                    "Khôi phục dự án do Báo cáo sự cố khẩn cấp bị từ chối.",
                    DateTime.UtcNow,
                    currentUserName);
                incident.Project.PausedAt = null;
                _unitOfWork.Repository<Project>().Update(incident.Project);
            }
        }

        var isInventoryIncident = incident.IncidentType == "InventoryLoss" || incident.IncidentType == "InventoryDamage";
        if (isInventoryIncident)
        {
            var adjustment = await _unitOfWork.Repository<InventoryAdjustment>().Query()
                .Include(a => a.Items)
                .Where(a => a.IncidentId == incident.IncidentId 
                    && a.AdjustmentType == InventoryAdjustmentType.Decrease 
                    && a.Status == InventoryAdjustmentStatus.Pending)
                .FirstOrDefaultAsync(cancellationToken);

            if (adjustment != null)
            {
                adjustment.Status = InventoryAdjustmentStatus.Rejected;
                adjustment.RejectedReason = request.Reason;
                adjustment.ApprovedBy = currentUserId;
                adjustment.ApprovedAt = System.DateTime.UtcNow;
                _unitOfWork.Repository<InventoryAdjustment>().Update(adjustment);

                foreach (var item in adjustment.Items)
                {
                    var currentInventory = await _unitOfWork.Repository<CurrentInventory>()
                        .FirstOrDefaultAsync(
                            inventory => inventory.ProjectId == adjustment.ProjectId && inventory.MaterialId == item.MaterialId,
                            cancellationToken);
                    if (currentInventory != null)
                    {
                        var baseQuantity = InventoryAdjustmentQuantity.ToBase(item);
                        currentInventory.ReservedQuantity = System.Math.Max(
                            0,
                            currentInventory.ReservedQuantity - baseQuantity);
                        currentInventory.LastUpdated = System.DateTime.UtcNow;
                        _unitOfWork.Repository<CurrentInventory>().Update(currentInventory);
                    }
                }
            }
        }

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

        var updatedIncident = await _unitOfWork.Repository<Incident>()
            .Query()
            .Include(i => i.Reporter)
            .Include(i => i.Reviewer)
            .FirstOrDefaultAsync(i => i.IncidentId == request.IncidentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Incident), request.IncidentId);

        await _notificationService.SendNotificationAsync(
            incident.ReportedBy,
            "Báo cáo sự cố bị từ chối",
            $"Sự cố bạn báo cáo đã bị từ chối. Lý do: {request.Reason}",
            "IncidentRejected",
            $"/projects/{incident.ProjectId}/workspace/incidents",
            incident.IncidentId,
            cancellationToken
        );

        var dto = _mapper.Map<IncidentDto>(updatedIncident);

        // Realtime: broadcast to all members currently viewing this project
        await _realtimeSender.SendToGroupAsync(
            HubMethodNames.GroupProject + updatedIncident.ProjectId,
            HubMethodNames.IncidentUpdated,
            updatedIncident.IncidentId,
            cancellationToken);

        // Realtime: broadcast to all members viewing global incidents (Project_0)
        await _realtimeSender.SendToGroupAsync(
            HubMethodNames.GroupProject + 0,
            HubMethodNames.IncidentUpdated,
            updatedIncident.IncidentId,
            cancellationToken);

        return ApiResponse<IncidentDto>.SuccessResult(dto, "Đã bác bỏ sự cố.");
    }

    private void ValidateTransitionAndPermission(Incident incident, long currentUserId)
    {
        if (incident.IsEmergency)
        {
            var hasPermission = incident.Status switch
            {
                "WaitingStopApproval" or "WaitingRecoveryPlan" => _currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager),
                "WaitingDirectorApproval" => _currentUserService.IsInRole(BPG.Domain.Constants.UserRole.Director),
                _ => throw new BusinessException("ERR_INVALID_STATUS", "Sự cố khẩn cấp không ở trạng thái có thể từ chối.")
            };

            if (!hasPermission)
                throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền từ chối bước này của sự cố khẩn cấp.");

            return;
        }

        if (incident.IncidentType is "InventoryLoss" or "InventoryDamage")
        {
            var hasPermission = incident.Status switch
            {
                "Reported" => incident.ReportedBy == currentUserId,
                IncidentStatus.WaitingAccountant => _currentUserService.IsInRole(BPG.Domain.Constants.UserRole.Accountant),
                IncidentStatus.UnderResolution => throw new BusinessException(
                    "ERR_USE_ADJUSTMENT_APPROVAL",
                    "Hãy từ chối phiếu giảm tồn liên kết để hoàn tất sự cố vật tư."),
                _ => throw new BusinessException("ERR_INVALID_STATUS", "Sự cố vật tư không ở trạng thái có thể từ chối.")
            };

            if (!hasPermission)
                throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền từ chối bước này của sự cố vật tư.");

            return;
        }

        if (incident.IncidentType != "Construction" || incident.Status != "WaitingReview")
            throw new BusinessException("ERR_INVALID_STATUS", "Sự cố thi công không ở trạng thái có thể từ chối.");

        if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager))
            throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền từ chối sự cố thi công.");
    }

    private static bool WasProjectPausedByIncident(string? pauseReason, long incidentId)
    {
        if (string.IsNullOrWhiteSpace(pauseReason))
            return false;

        try
        {
            var history = System.Text.Json.Nodes.JsonNode.Parse(pauseReason) as System.Text.Json.Nodes.JsonArray;
            var lastItem = history?.LastOrDefault();
            var type = lastItem?["type"]?.GetValue<string>() ?? lastItem?["Type"]?.GetValue<string>();
            var reason = lastItem?["reason"]?.GetValue<string>() ?? lastItem?["Reason"]?.GetValue<string>();
            var incidentIdNode = lastItem?["emergencyIncidentId"] ?? lastItem?["EmergencyIncidentId"];
            var hasIncidentId = long.TryParse(incidentIdNode?.ToString(), out var pausedByIncidentId);

            return type == "pause"
                && ((hasIncidentId && pausedByIncidentId == incidentId)
                    || reason?.Contains($"[EmergencyIncident:{incidentId}]", StringComparison.Ordinal) == true);
        }
        catch (System.Text.Json.JsonException)
        {
            return false;
        }
    }

    private string AppendStatusHistory(string? currentReason, string type, string? reason, DateTime timestamp, string userName)
    {
        var item = new
        {
            type = type,
            reason = reason ?? string.Empty,
            timestamp = timestamp.ToString("o"),
            user = userName
        };

        var newItemJson = System.Text.Json.JsonSerializer.Serialize(item);

        if (string.IsNullOrWhiteSpace(currentReason))
        {
            return $"[{newItemJson}]";
        }

        try
        {
            var list = System.Text.Json.JsonSerializer.Deserialize<List<System.Text.Json.Nodes.JsonNode>>(currentReason);
            if (list != null)
            {
                var node = System.Text.Json.Nodes.JsonNode.Parse(newItemJson);
                if (node != null) list.Add(node);
                return System.Text.Json.JsonSerializer.Serialize(list);
            }
        }
        catch
        {
            // fallback
        }

        var legacyItem = System.Text.Json.JsonSerializer.Serialize(new
        {
            type = "pause",
            reason = currentReason,
            timestamp = DateTime.UtcNow.ToString("o"),
            user = "Hệ thống"
        });
        return $"[{legacyItem},{newItemJson}]";
    }
}
