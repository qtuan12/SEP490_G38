using BPG.Application.Common.Models;
using BPG.Application.DTOs.Incidents;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentValidation;
using MediatR;
using AutoMapper;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Incidents.Commands.RejectIncident;

public record RejectIncidentCommand(long IncidentId, string Reason) : IRequest<ApiResponse<IncidentDto>>;

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

    public RejectIncidentCommandHandler(IUnitOfWork unitOfWork, IMapper mapper, ICurrentUserService currentUserService, INotificationService notificationService)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _currentUserService = currentUserService;
        _notificationService = notificationService;
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

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var updatedIncident = await _unitOfWork.Repository<Incident>()
            .Query()
            .Include(i => i.Reporter)
            .Include(i => i.Reviewer)
            .FirstOrDefaultAsync(i => i.IncidentId == request.IncidentId, cancellationToken);

        await _notificationService.SendNotificationAsync(
            incident.ReportedBy,
            "Báo cáo sự cố bị từ chối",
            $"Sự cố bạn báo cáo đã bị từ chối. Lý do: {request.Reason}",
            "IncidentRejected",
            $"/projects/{incident.ProjectId}/workspace/incidents"
        );

        return ApiResponse<IncidentDto>.SuccessResult(_mapper.Map<IncidentDto>(updatedIncident), "Đã từ chối sự cố.");
    }
}
