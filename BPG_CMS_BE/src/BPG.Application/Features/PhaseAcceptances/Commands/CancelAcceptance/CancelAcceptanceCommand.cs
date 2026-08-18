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
            .GreaterThan(0).WithMessage("AcceptanceId không hợp lệ.");

        RuleFor(x => x.CancellationReason)
            .NotEmpty().WithMessage("Lý do hủy không được để trống.");
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
        if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager))
        {
            throw new ForbiddenException("Chỉ Trưởng phòng kỹ thuật mới được phép hủy nghiệm thu giai đoạn.");
        }

        var acceptanceRepo = _unitOfWork.Repository<PhaseAcceptance>();
        var phaseRepo = _unitOfWork.Repository<Phase>();

        var acceptance = await acceptanceRepo.Query()
            .Include(x => x.Phase)
                .ThenInclude(p => p.Project)
            .FirstOrDefaultAsync(x => x.AcceptanceId == request.AcceptanceId, ct);

        if (acceptance == null)
            throw new NotFoundException(nameof(PhaseAcceptance), request.AcceptanceId);

        if (acceptance.Phase?.Project?.Status != ProjectStatus.InProgress)
        {
            throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", "Dự án hiện không ở trạng thái hoạt động.");
        }

        if (acceptance.IsCancelled)
            throw new BusinessException("INVALID_STATUS", "Biên bản nghiệm thu này đã bị hủy trước đó.");

        // Rule: Only allow cancellation within 7 days.
        // AcceptanceDate lưu bằng UTC nên phải trừ bằng UTC — trừ bằng giờ máy chủ sẽ lệch
        // đúng bằng offset múi giờ của server.
        var daysPassed = (DateTime.UtcNow - acceptance.AcceptanceDate).TotalDays;
        if (daysPassed > 7)
            throw new BusinessException("INVALID_OPERATION", "Chỉ được phép hủy nghiệm thu trong vòng 7 ngày kể từ lúc lập biên bản.");

        // Update Acceptance
        acceptance.IsCancelled = true;
        acceptance.CancellationReason = request.CancellationReason;
        acceptance.CancelledAt = DateTime.UtcNow;
        acceptance.CancelledBy = _currentUserService.GetRequiredUserId();
        acceptanceRepo.Update(acceptance);

        // Unlock Phase
        if (acceptance.Phase != null)
        {
            acceptance.Phase.Status = PhaseStatus.InProgress;
            phaseRepo.Update(acceptance.Phase);
        }

        await _unitOfWork.SaveChangesAsync(ct);

        // Gửi thông báo realtime
        try
        {
            var userId = _currentUserService.GetRequiredUserId();
            var project = acceptance.Phase?.Project;
            var phaseName = acceptance.Phase?.Name ?? "Giai đoạn";
            var projectName = project?.Name ?? "Dự án";

            // 1. Gửi thông báo đến Giám đốc (trừ người thực hiện)
            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Director,
                "Hủy nghiệm thu giai đoạn",
                $"Biên bản nghiệm thu của giai đoạn '{phaseName}' thuộc dự án '{projectName}' đã bị hủy.",
                NotificationType.Progress,
                userId,
                $"/projects/{acceptance.Phase?.ProjectId}/phases/{acceptance.Phase?.PhaseId}/acceptance",
                acceptance.AcceptanceId,
                ct);

            // 2. Gửi thông báo tới Project Leader (Chỉ huy trưởng) của dự án (trừ người thực hiện)
            if (project != null)
            {
                var projectLeader = await _unitOfWork.Repository<ProjectMember>().Query()
                    .FirstOrDefaultAsync(pm => pm.ProjectId == project.ProjectId && pm.IsLeader && pm.UserId != userId, ct);
                if (projectLeader != null)
                {
                    await _notificationService.SendNotificationAsync(
                        projectLeader.UserId,
                        "Hủy nghiệm thu giai đoạn",
                        $"Biên bản nghiệm thu của giai đoạn '{phaseName}' thuộc dự án '{projectName}' đã bị hủy.",
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

