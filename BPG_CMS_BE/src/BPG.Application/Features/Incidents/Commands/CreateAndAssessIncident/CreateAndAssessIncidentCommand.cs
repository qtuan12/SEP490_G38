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
            .WithMessage("Sá»± cá»‘ thi cÃ´ng yÃªu cáº§u TaskId.");

        RuleFor(v => v.PhaseId)
            .NotNull()
            .When(v => v.IncidentType == "InventoryLoss" || v.IncidentType == "InventoryDamage")
            .WithMessage("Sá»± cá»‘ váº­t tÆ° yÃªu cáº§u PhaseId.");
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

        if (request.TaskId.HasValue)
        {
            var task = await _unitOfWork.Repository<ProjectTask>()
                .Query()
                .FirstOrDefaultAsync(t => t.TaskId == request.TaskId.Value, cancellationToken);

            if (task == null)
            {
                throw new NotFoundException(nameof(ProjectTask), request.TaskId.Value);
            }
        }

        if (request.PhaseId.HasValue)
        {
            var phase = await _unitOfWork.Repository<Phase>()
                .Query()
                .FirstOrDefaultAsync(p => p.PhaseId == request.PhaseId.Value, cancellationToken);

            if (phase == null)
            {
                throw new NotFoundException(nameof(Phase), request.PhaseId.Value);
            }
        }

        // Determine which queue this incident goes to based on its type
        var isInventoryIncident = request.IncidentType == "InventoryLoss" || request.IncidentType == "InventoryDamage";

        var incident = new Incident
        {
            ProjectId = request.ProjectId,
            TaskId = request.TaskId,
            PhaseId = request.PhaseId,
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
                "BÃ¡o cÃ¡o sá»± cá»‘ má»›i",
                $"CÃ³ má»™t sá»± cá»‘ váº­t tÆ° má»›i táº¡i dá»± Ã¡n {project.Name} Ä‘ang chá» káº¿ toÃ¡n xÃ¡c minh.",
                "IncidentReported",
                $"/projects/{project.ProjectId}/workspace/incidents"
            );
        }
        else
        {
            if (request.IsEmergency)
            {
                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.TechnicalManager,
                    "ðŸš¨ YÃªu cáº§u dá»«ng thi cÃ´ng kháº©n cáº¥p",
                    $"Dá»± Ã¡n {project.Name} vá»«a gá»­i yÃªu cáº§u táº¡m dá»«ng thi cÃ´ng kháº©n cáº¥p do sá»± cá»‘ nghiÃªm trá»ng. Vui lÃ²ng tháº©m Ä‘á»‹nh ngay!",
                    "EmergencyStop",
                    $"/projects/{project.ProjectId}/workspace/incidents"
                );

                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.Director,
                    "ðŸš¨ YÃªu cáº§u dá»«ng thi cÃ´ng kháº©n cáº¥p",
                    $"Dá»± Ã¡n {project.Name} vá»«a gá»­i yÃªu cáº§u táº¡m dá»«ng thi cÃ´ng kháº©n cáº¥p do sá»± cá»‘ nghiÃªm trá»ng.",
                    "EmergencyStop",
                    $"/projects/{project.ProjectId}/workspace/incidents"
                );
            }
            else
            {
                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.TechnicalManager,
                    "BÃ¡o cÃ¡o sá»± cá»‘ má»›i",
                    $"CÃ³ má»™t sá»± cá»‘ thi cÃ´ng má»›i táº¡i dá»± Ã¡n {project.Name} Ä‘ang chá» TrÆ°á»Ÿng phÃ²ng Ká»¹ thuáº­t tháº©m Ä‘á»‹nh.",
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

        return ApiResponse<IncidentDto>.SuccessResult(dto, "Sá»± cá»‘ Ä‘Ã£ Ä‘Æ°á»£c bÃ¡o cÃ¡o vÃ  Ä‘Ã¡nh giÃ¡.");
    }
}

