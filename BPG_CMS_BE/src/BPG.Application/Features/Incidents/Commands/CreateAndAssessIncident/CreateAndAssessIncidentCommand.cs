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
    string IncidentType,
    string Description,
    string? DamageDescription,
    decimal? EstimatedMaterialLoss,
    decimal? EstimatedLaborDays,
    int? EstimatedDelayDays,
    string? ProposedAction
) : IRequest<ApiResponse<IncidentDto>>;

public class CreateAndAssessIncidentCommandValidator : AbstractValidator<CreateAndAssessIncidentCommand>
{
    public CreateAndAssessIncidentCommandValidator()
    {
        RuleFor(v => v.ProjectId).GreaterThan(0).WithMessage("ProjectId is required.");
        RuleFor(v => v.IncidentType).NotEmpty().WithMessage("IncidentType is required.");
        RuleFor(v => v.Description).NotEmpty().WithMessage("Description is required.");
    }
}

public class CreateAndAssessIncidentCommandHandler : IRequestHandler<CreateAndAssessIncidentCommand, ApiResponse<IncidentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ICurrentUserService _currentUserService;

    public CreateAndAssessIncidentCommandHandler(IUnitOfWork unitOfWork, IMapper mapper, ICurrentUserService currentUserService)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _currentUserService = currentUserService;
    }

    public async Task<ApiResponse<IncidentDto>> Handle(CreateAndAssessIncidentCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = Convert.ToInt64(_currentUserService.UserId);

        // Security check: Ensure the SiteEngineer is actually the ProjectLeader (or Admin/TPKT)
        var isLeader = await _unitOfWork.Repository<ProjectMember>()
            .Query()
            .AnyAsync(pm => pm.ProjectId == request.ProjectId && pm.UserId == currentUserId && pm.IsLeader, cancellationToken);
        var isPrivileged = _currentUserService.Roles.Contains(BPG.Domain.Constants.UserRole.TechnicalManager) || _currentUserService.Roles.Contains(BPG.Domain.Constants.UserRole.Admin);

        if (!isLeader && !isPrivileged)
        {
            throw new ForbiddenException("Chỉ có Project Leader của dự án mới được quyền báo cáo sự cố.");
        }

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

        // Determine which queue this incident goes to based on its type
        var isInventoryIncident = request.IncidentType == "InventoryLoss" || request.IncidentType == "InventoryDamage";

        var incident = new Incident
        {
            ProjectId = request.ProjectId,
            TaskId = request.TaskId,
            ReportedBy = currentUserId,
            IncidentType = request.IncidentType,
            Description = request.Description,
            DamageDescription = request.DamageDescription,
            EstimatedMaterialLoss = request.EstimatedMaterialLoss,
            EstimatedLaborDays = request.EstimatedLaborDays,
            EstimatedDelayDays = request.EstimatedDelayDays,
            ProposedAction = request.ProposedAction,
            // Nhánh 1 (thi công): chờ TPKT thẩm định
            // Nhánh 2 (kho):      chờ Kế toán xác minh
            Status = isInventoryIncident ? "WaitingAccountant" : "WaitingReview",
        };

        await _unitOfWork.Repository<Incident>().AddAsync(incident);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Load relations for mapping
        incident = await _unitOfWork.Repository<Incident>()
            .Query()
            .Include(i => i.Reporter)
            .Include(i => i.Reviewer)
            .FirstOrDefaultAsync(i => i.IncidentId == incident.IncidentId, cancellationToken);

        var dto = _mapper.Map<IncidentDto>(incident);

        return ApiResponse<IncidentDto>.SuccessResult(dto, "Sự cố đã được báo cáo và đánh giá.");
    }
}
