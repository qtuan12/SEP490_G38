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

namespace BPG.Application.Features.Incidents.Commands.CreateAndAssessIncident;

public record CreateAndAssessIncidentCommand(
    long ProjectId,
    long? TaskId,
    long? PhaseId,
    string IncidentType,
    string Description,
    string? DamageDescription,
    decimal? EstimatedMaterialLoss,
    decimal? EstimatedLaborDays,
    int? EstimatedDelayDays,
    string? ProposedAction,
    bool IsEmergency = false
) : IRequest<ApiResponse<IncidentDto>>
{
}

public class CreateAndAssessIncidentCommandValidator : AbstractValidator<CreateAndAssessIncidentCommand>
{
    public CreateAndAssessIncidentCommandValidator()
    {
        RuleFor(v => v.ProjectId).GreaterThan(0).WithMessage("ProjectId is required.");
        RuleFor(v => v.IncidentType).NotEmpty().WithMessage("IncidentType is required.");
        RuleFor(v => v.Description).NotEmpty().WithMessage("Description is required.");

        RuleFor(v => v.TaskId)
            .NotNull()
            .When(v => v.IncidentType == "Construction" && !v.IsEmergency)
            .WithMessage("Sự cố thi công yêu cầu TaskId.");

        RuleFor(v => v.PhaseId)
            .NotNull()
            .When(v => v.IncidentType == "InventoryLoss" || v.IncidentType == "InventoryDamage")
            .WithMessage("Sự cố vật tư yêu cầu PhaseId.");
    }
}

public class CreateAndAssessIncidentCommandHandler : IRequestHandler<CreateAndAssessIncidentCommand, ApiResponse<IncidentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ICurrentUserService _currentUserService;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotificationSender _realtimeSender;

    public CreateAndAssessIncidentCommandHandler(IUnitOfWork unitOfWork, IMapper mapper, ICurrentUserService currentUserService, INotificationService notificationService, IRealtimeNotificationSender realtimeSender)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _currentUserService = currentUserService;
        _notificationService = notificationService;
        _realtimeSender = realtimeSender;
    }

    public async Task<ApiResponse<IncidentDto>> Handle(CreateAndAssessIncidentCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = Convert.ToInt64(_currentUserService.UserId);

        var project = await _unitOfWork.Repository<Project>()
            .Query()
            .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, cancellationToken);

        if (project == null)
        {
            throw new NotFoundException(nameof(Project), request.ProjectId);
        }

        var isProjectMember = await _unitOfWork.Repository<ProjectMember>().AnyAsync(
            member => member.ProjectId == request.ProjectId && member.UserId == currentUserId,
            cancellationToken);

        var isManagementRole = _currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager) || _currentUserService.IsInRole(BPG.Domain.Constants.UserRole.Director);

        if (!isProjectMember && !isManagementRole)
        {
            throw new ForbiddenException("Bạn không có quyền báo cáo sự cố cho dự án này.");
        }

        long? phaseId = request.PhaseId;

        if (request.TaskId.HasValue)
        {
            var task = await _unitOfWork.Repository<ProjectTask>()
                .Query()
                .FirstOrDefaultAsync(t => t.TaskId == request.TaskId.Value, cancellationToken);

            if (task == null)
            {
                throw new NotFoundException(nameof(ProjectTask), request.TaskId.Value);
            }

            if (!phaseId.HasValue)
            {
                phaseId = task.PhaseId;
            }
        }

        if (phaseId.HasValue)
        {
            var phase = await _unitOfWork.Repository<Phase>()
                .Query()
                .FirstOrDefaultAsync(p => p.PhaseId == phaseId.Value, cancellationToken);

            if (phase == null)
            {
                throw new NotFoundException(nameof(Phase), phaseId.Value);
            }
        }

        // Determine which queue this incident goes to based on its type
        var isInventoryIncident = request.IncidentType == "InventoryLoss" || request.IncidentType == "InventoryDamage";

        var incident = new Incident
        {
            ProjectId = request.ProjectId,
            TaskId = request.TaskId,
            PhaseId = phaseId,
            ReportedBy = currentUserId,
            IncidentType = request.IncidentType,
            Description = request.Description,
            DamageDescription = request.DamageDescription,
            EstimatedMaterialLoss = request.EstimatedMaterialLoss,
            EstimatedLaborDays = request.EstimatedLaborDays,
            EstimatedDelayDays = request.EstimatedDelayDays,
            ProposedAction = request.ProposedAction,
            IsEmergency = request.IsEmergency,
            Status = request.IsEmergency ? "WaitingStopApproval" : (isInventoryIncident ? "WaitingAccountant" : "WaitingReview"),
        };

        await _unitOfWork.Repository<Incident>().AddAsync(incident);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Load relations for mapping
        incident = await _unitOfWork.Repository<Incident>()
            .Query()
            .Include(i => i.Reporter)
            .Include(i => i.Reviewer)
            .FirstOrDefaultAsync(i => i.IncidentId == incident.IncidentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Incident), incident.IncidentId);

        if (isInventoryIncident)
        {
            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Accountant,
                "📦 Báo cáo sự cố vật tư kho mới",
                $"Dự án {project.Name} vừa báo cáo sự cố vật tư kho. Vui lòng xác minh và tạo phiếu kiểm kê giảm tồn kho.",
                "InventoryIncidentReported",
                $"/projects/{project.ProjectId}/workspace/incidents"
            );
        }
        else
        {
            if (request.IsEmergency)
            {
                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.TechnicalManager,
                    "🚨 Yêu cầu dừng thi công khẩn cấp",
                    $"Dự án {project.Name} vừa gửi yêu cầu tạm dừng thi công khẩn cấp do sự cố nghiêm trọng. Vui lòng thẩm định ngay!",
                    "EmergencyStop",
                    $"/projects/{project.ProjectId}/workspace/incidents"
                );

                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.Director,
                    "🚨 Yêu cầu dừng thi công khẩn cấp",
                    $"Dự án {project.Name} vừa gửi yêu cầu tạm dừng thi công khẩn cấp do sự cố nghiêm trọng.",
                    "EmergencyStop",
                    $"/projects/{project.ProjectId}/workspace/incidents"
                );

                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.Accountant,
                    "🚨 Yêu cầu dừng thi công khẩn cấp",
                    $"Dự án {project.Name} vừa gửi yêu cầu tạm dừng thi công khẩn cấp do sự cố nghiêm trọng.",
                    "EmergencyStop",
                    $"/projects/{project.ProjectId}/workspace/incidents"
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
                            "🚨 Yêu cầu dừng thi công khẩn cấp",
                            $"Dự án {incident.Project?.Name ?? project.Name} vừa gửi yêu cầu tạm dừng thi công khẩn cấp do sự cố nghiêm trọng.",
                            "EmergencyStop",
                            $"/projects/{incident.ProjectId}/workspace/incidents"
                        );
                    }
                }
            }
            else
            {
                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.TechnicalManager,
                    "Báo cáo sự cố mới",
                    $"Có một sự cố thi công mới tại dự án {project.Name} đang chờ Trưởng phòng Kỹ thuật thẩm định.",
                    "IncidentReported",
                    $"/projects/{project.ProjectId}/workspace/incidents"
                );
            }
        }

        var dto = _mapper.Map<IncidentDto>(incident);

        // Realtime: broadcast to all members currently viewing this project
        await _realtimeSender.SendToGroupAsync(
            HubMethodNames.GroupProject + request.ProjectId,
            HubMethodNames.IncidentCreated,
            incident.IncidentId,
            cancellationToken);

        // Realtime: broadcast to all members viewing global incidents (Project_0)
        await _realtimeSender.SendToGroupAsync(
            HubMethodNames.GroupProject + 0,
            HubMethodNames.IncidentCreated,
            incident.IncidentId,
            cancellationToken);

        return ApiResponse<IncidentDto>.SuccessResult(dto, "Sự cố đã được báo cáo và đánh giá.");
    }
}

