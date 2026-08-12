using BPG.Application.Common.Models;
using BPG.Application.DTOs.Incidents;
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

        incident.Status = "Rejected";
        incident.ReviewedBy = currentUserId;
        incident.HandlingInstruction = request.Reason; // Lưu lý do vào HandlingInstruction

        if (incident.IsEmergency && incident.Project != null && incident.Project.Status == ProjectStatus.Paused)
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
                        currentInventory.ReservedQuantity = System.Math.Max(0, currentInventory.ReservedQuantity - item.Quantity);
                        currentInventory.LastUpdated = System.DateTime.UtcNow;
                        _unitOfWork.Repository<CurrentInventory>().Update(currentInventory);
                    }
                }
            }
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

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
            $"/projects/{incident.ProjectId}/workspace/incidents"
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

    private string AppendStatusHistory(string? currentReason, string type, string? reason, DateTime timestamp, string userName)
    {
        var item = new
        {
            type = type,
            reason = reason ?? string.Empty,
            timestamp = timestamp.ToString("o"),
            userName = userName
        };

        var newItemJson = System.Text.Json.JsonSerializer.Serialize(item);

        if (string.IsNullOrWhiteSpace(currentReason))
        {
            return $"{newItemJson}";
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

        return $"{newItemJson}";
    }
}
