using BPG.Domain.Exceptions;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PhaseAcceptances.Commands.CancelAcceptance;

public record CancelAcceptanceCommand(long AcceptanceId, string CancellationReason)
    : IRequest<bool>
{
}

public class CancelAcceptanceCommandValidator : AbstractValidator<CancelAcceptanceCommand>
{
    public CancelAcceptanceCommandValidator()
    {
        RuleFor(x => x.AcceptanceId)
            .GreaterThan(0).WithMessage("AcceptanceId khÃ´ng há»£p lá»‡.");

        RuleFor(x => x.CancellationReason)
            .NotEmpty().WithMessage("LÃ½ do há»§y khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.");
    }
}

public class CancelAcceptanceCommandHandler : IRequestHandler<CancelAcceptanceCommand, bool>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUserService;
    private readonly INotificationService _notificationService;

    public CancelAcceptanceCommandHandler(
        IUnitOfWork unitOfWork, 
        ICurrentUserService currentUserService,
        INotificationService notificationService)
    {
        _unitOfWork = unitOfWork;
        _currentUserService = currentUserService;
        _notificationService = notificationService;
    }

    public async Task<bool> Handle(CancelAcceptanceCommand request, CancellationToken ct)
    {
        var acceptanceRepo = _unitOfWork.Repository<PhaseAcceptance>();
        var phaseRepo = _unitOfWork.Repository<Phase>();

        var acceptance = await acceptanceRepo.Query()
            .Include(x => x.Phase)
                .ThenInclude(p => p.Project)
            .FirstOrDefaultAsync(x => x.AcceptanceId == request.AcceptanceId, ct);

        if (acceptance == null)
            throw new NotFoundException(nameof(PhaseAcceptance), request.AcceptanceId);

        if (acceptance.IsCancelled)
            throw new BusinessException("INVALID_STATUS", "BiÃªn báº£n nghiá»‡m thu nÃ y Ä‘Ã£ bá»‹ há»§y trÆ°á»›c Ä‘Ã³.");

        // Rule: Only allow cancellation within 7 days
        var daysPassed = (DateTime.Now - acceptance.AcceptanceDate).TotalDays;
        if (daysPassed > 7)
            throw new BusinessException("INVALID_OPERATION", "Chá»‰ Ä‘Æ°á»£c phÃ©p há»§y nghiá»‡m thu trong vÃ²ng 7 ngÃ y ká»ƒ tá»« lÃºc láº­p biÃªn báº£n.");

        // Update Acceptance
        acceptance.IsCancelled = true;
        acceptance.CancellationReason = request.CancellationReason;
        acceptance.CancelledAt = DateTime.Now;
        acceptance.CancelledBy = _currentUserService.GetRequiredUserId();
        acceptanceRepo.Update(acceptance);

        // Unlock Phase
        if (acceptance.Phase != null)
        {
            acceptance.Phase.Status = PhaseStatus.InProgress;
            phaseRepo.Update(acceptance.Phase);
        }

        await _unitOfWork.SaveChangesAsync(ct);

        // Gá»­i thÃ´ng bÃ¡o realtime
        try
        {
            var project = acceptance.Phase?.Project;
            var phaseName = acceptance.Phase?.Name ?? "Giai Ä‘oáº¡n";
            var projectName = project?.Name ?? "Dá»± Ã¡n";

            // 1. Gá»­i thÃ´ng bÃ¡o Ä‘áº¿n GiÃ¡m Ä‘á»‘c
            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Director,
                "Há»§y nghiá»‡m thu giai Ä‘oáº¡n",
                $"BiÃªn báº£n nghiá»‡m thu cá»§a giai Ä‘oáº¡n '{phaseName}' thuá»™c dá»± Ã¡n '{projectName}' Ä‘Ã£ bá»‹ há»§y.",
                NotificationType.Progress,
                $"/projects/{acceptance.Phase?.ProjectId}/phases/{acceptance.Phase?.PhaseId}/acceptance",
                acceptance.AcceptanceId,
                ct);

            // 2. Gá»­i thÃ´ng bÃ¡o tá»›i Project Leader (Chá»‰ huy trÆ°á»Ÿng) cá»§a dá»± Ã¡n
            if (project != null)
            {
                var projectLeader = await _unitOfWork.Repository<ProjectMember>().Query()
                    .FirstOrDefaultAsync(pm => pm.ProjectId == project.ProjectId && pm.IsLeader, ct);
                if (projectLeader != null)
                {
                    await _notificationService.SendNotificationAsync(
                        projectLeader.UserId,
                        "Há»§y nghiá»‡m thu giai Ä‘oáº¡n",
                        $"BiÃªn báº£n nghiá»‡m thu cá»§a giai Ä‘oáº¡n '{phaseName}' thuá»™c dá»± Ã¡n '{projectName}' Ä‘Ã£ bá»‹ há»§y.",
                        NotificationType.Progress,
                        $"/projects/{acceptance.Phase?.ProjectId}/phases/{acceptance.Phase?.PhaseId}/acceptance",
                        acceptance.AcceptanceId,
                        ct);
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error sending notification: {ex.Message}");
        }

        return true;
    }
}

