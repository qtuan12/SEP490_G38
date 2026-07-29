using BPG.Domain.Exceptions;
using BPG.Application.DTOs;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PhaseAcceptances.Commands.AcceptPhase;

public record AcceptPhaseCommand(long PhaseId, string ReportContent)
    : IRequest<long>
{
}

public class AcceptPhaseCommandValidator : AbstractValidator<AcceptPhaseCommand>
{
    public AcceptPhaseCommandValidator()
    {
        RuleFor(x => x.PhaseId)
            .GreaterThan(0).WithMessage("PhaseId khÃ´ng há»£p lá»‡.");

        RuleFor(x => x.ReportContent)
            .NotEmpty().WithMessage("Ná»™i dung bÃ¡o cÃ¡o khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.");
    }
}

public class AcceptPhaseCommandHandler : IRequestHandler<AcceptPhaseCommand, long>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUserService;
    private readonly IPdfService _pdfService;
    private readonly IFileStorageService _fileStorageService;
    private readonly INotificationService _notificationService;

    public AcceptPhaseCommandHandler(
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUserService,
        IPdfService pdfService,
        IFileStorageService fileStorageService,
        INotificationService notificationService)
    {
        _unitOfWork = unitOfWork;
        _currentUserService = currentUserService;
        _pdfService = pdfService;
        _fileStorageService = fileStorageService;
        _notificationService = notificationService;
    }

    public async Task<long> Handle(AcceptPhaseCommand request, CancellationToken ct)
    {
        var phaseRepo = _unitOfWork.Repository<Phase>();
        var taskRepo = _unitOfWork.Repository<ProjectTask>();
        var acceptanceRepo = _unitOfWork.Repository<PhaseAcceptance>();
        var userRepo = _unitOfWork.Repository<User>();

        // 1. Get Phase
        var phase = await phaseRepo.Query()
            .Include(x => x.Project)
            .FirstOrDefaultAsync(x => x.PhaseId == request.PhaseId, ct);

        if (phase == null)
            throw new NotFoundException(nameof(Phase), request.PhaseId);

        if (phase.Status == PhaseStatus.Approved)
            throw new BusinessException("INVALID_STATUS", "Phase nÃ y Ä‘Ã£ Ä‘Æ°á»£c nghiá»‡m thu vÃ  hoÃ n thÃ nh trÆ°á»›c Ä‘Ã³.");

        // 2. Validate all Tasks 100%
        var tasks = await taskRepo.Query()
            .Include(x => x.Assignees)
            .ThenInclude(a => a.User)
            .Where(x => x.PhaseId == request.PhaseId)
            .ToListAsync(ct);

        var nonObsoleteTasks = tasks.Where(t => t.Status != BPG.Domain.Constants.TaskStatus.Obsolete).ToList();

        if (nonObsoleteTasks.Count == 0)
            throw new BusinessException("INVALID_OPERATION", "KhÃ´ng thá»ƒ nghiá»‡m thu Phase chÆ°a cÃ³ cÃ´ng viá»‡c hoáº¡t Ä‘á»™ng nÃ o.");

        if (nonObsoleteTasks.Any(t => t.ProgressPercent < 100))
            throw new BusinessException("INVALID_OPERATION", "KhÃ´ng thá»ƒ nghiá»‡m thu Phase khi chÆ°a hoÃ n thÃ nh 100% táº¥t cáº£ cÃ¡c cÃ´ng viá»‡c hoáº¡t Ä‘á»™ng.");

        var userId = _currentUserService.GetRequiredUserId();
        var user = await userRepo.GetByIdAsync(userId, ct);
        var currentUserFullName = user?.FullName ?? "Unknown User";

        // 3. Generate PDF
        var pdfModel = new PhaseAcceptancePdfModel
        {
            ProjectName = phase.Project?.Name ?? "Unknown Project",
            PhaseName = phase.Name,
            AcceptedByFullName = currentUserFullName,
            AcceptanceDate = DateTime.Now,
            ReportContent = request.ReportContent,
            Tasks = nonObsoleteTasks.Select(t => new PhaseAcceptanceTaskDto
            {
                TaskName = t.Name,
                AssigneeName = t.Assignees.FirstOrDefault()?.User?.FullName ?? "ChÆ°a phÃ¢n cÃ´ng",
                ProgressPercent = t.ProgressPercent
            }).ToList()
        };

        var pdfBytes = _pdfService.GeneratePhaseAcceptancePdf(pdfModel);

        // 4. Upload PDF
        string fileName = $"BienBanNghiemThu_Phase_{phase.PhaseId}_{DateTime.Now:yyyyMMddHHmmss}.pdf";
        string pdfUrl = await _fileStorageService.UploadFileAsync(pdfBytes, fileName, StorageFolders.AcceptanceDocs, ct);

        // 5. Save Acceptance (Always insert a new one to keep history)
        var acceptance = new PhaseAcceptance
        {
            PhaseId = phase.PhaseId,
            AcceptedBy = userId,
            AcceptanceDate = DateTime.Now,
            ReportContent = request.ReportContent,
            PdfUrl = pdfUrl,
            IsCancelled = false
        };

        await acceptanceRepo.AddAsync(acceptance, ct);

        // 6. Update Phase Status
        phase.Status = PhaseStatus.Approved;
        phaseRepo.Update(phase);

        await _unitOfWork.SaveChangesAsync(ct);

        // Gá»­i thÃ´ng bÃ¡o realtime
        try
        {
            // 1. Gá»­i thÃ´ng bÃ¡o Ä‘áº¿n GiÃ¡m Ä‘á»‘c
            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Director,
                "Nghiá»‡m thu hoÃ n thÃ nh giai Ä‘oáº¡n",
                $"Giai Ä‘oáº¡n '{phase.Name}' cá»§a dá»± Ã¡n '{phase.Project?.Name}' Ä‘Ã£ Ä‘Æ°á»£c nghiá»‡m thu vÃ  hoÃ n thÃ nh.",
                NotificationType.Progress,
                $"/projects/{phase.ProjectId}/phases/{phase.PhaseId}/acceptance",
                acceptance.AcceptanceId,
                ct);

            // 2. Gá»­i thÃ´ng bÃ¡o tá»›i Project Leader (Chá»‰ huy trÆ°á»Ÿng) cá»§a dá»± Ã¡n
            var projectLeader = await _unitOfWork.Repository<ProjectMember>().Query()
                .FirstOrDefaultAsync(pm => pm.ProjectId == phase.ProjectId && pm.IsLeader, ct);
            if (projectLeader != null)
            {
                await _notificationService.SendNotificationAsync(
                    projectLeader.UserId,
                    "Nghiá»‡m thu hoÃ n thÃ nh giai Ä‘oáº¡n",
                    $"Giai Ä‘oáº¡n '{phase.Name}' cá»§a dá»± Ã¡n '{phase.Project?.Name}' Ä‘Ã£ Ä‘Æ°á»£c nghiá»‡m thu.",
                    NotificationType.Progress,
                    $"/projects/{phase.ProjectId}/phases/{phase.PhaseId}/acceptance",
                    acceptance.AcceptanceId,
                    ct);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error sending notification: {ex.Message}");
        }

        return acceptance.AcceptanceId;
    }
}

