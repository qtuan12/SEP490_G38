using BPG.Application.Common.Models;
using BPG.Application.Common.Authorization;
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
    : IRequest<ApiResponse<IncidentDto>>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.Incident(IncidentId);
    public string RequiredPermission => ProjectPermission.TechnicalManage;
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
            .FirstOrDefaultAsync(i => i.IncidentId == request.IncidentId, cancellationToken);

        if (incident == null)
            throw new NotFoundException(nameof(Incident), request.IncidentId);

        if (incident.Status == "Approved" || incident.Status == "Rejected")
            throw new BusinessException("ERR_INCIDENT_ALREADY_PROCESSED", "Sự cố này đã được xử lý.");

        incident.Status = "Rejected";
        incident.ReviewedBy = currentUserId;
        incident.HandlingInstruction = request.Reason; // Lưu lý do vào HandlingInstruction

        var isInventoryIncident = incident.IncidentType == "InventoryLoss" || incident.IncidentType == "InventoryDamage";
        if (isInventoryIncident)
        {
            var adjustment = await _unitOfWork.Repository<InventoryAdjustment>().Query()
                .Where(a => a.ProjectId == incident.ProjectId && a.PhaseId == incident.PhaseId && a.Status == InventoryAdjustmentStatus.Pending)
                .OrderBy(a => a.AdjustmentId)
                .FirstOrDefaultAsync(cancellationToken);

            if (adjustment != null)
            {
                adjustment.Status = InventoryAdjustmentStatus.Rejected;
                adjustment.RejectedReason = request.Reason;
                adjustment.ApprovedBy = currentUserId;
                adjustment.ApprovedAt = System.DateTime.UtcNow;
                _unitOfWork.Repository<InventoryAdjustment>().Update(adjustment);
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
}
