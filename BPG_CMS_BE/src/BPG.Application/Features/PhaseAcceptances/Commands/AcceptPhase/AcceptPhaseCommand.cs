using BPG.Domain.Common;
using BPG.Domain.Exceptions;
using BPG.Application.DTOs;
using BPG.Application.Features.Wbs.Services;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Data;

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
            .GreaterThan(0).WithMessage("PhaseId không hợp lệ.");

        RuleFor(x => x.ReportContent)
            .NotEmpty().WithMessage("Nội dung báo cáo không được để trống.");
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
        if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager))
        {
            throw new ForbiddenException("Chỉ Trưởng phòng kỹ thuật mới được phép nghiệm thu giai đoạn.");
        }

        var phaseRepo = _unitOfWork.Repository<Phase>();
        var taskRepo = _unitOfWork.Repository<ProjectTask>();
        var acceptanceRepo = _unitOfWork.Repository<PhaseAcceptance>();
        var userRepo = _unitOfWork.Repository<User>();

        await _unitOfWork.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await _unitOfWork.ExecuteSqlAsync(WbsStructureLock.AcquirePhase(request.PhaseId), ct);

        // 1. Get Phase
        var phase = await phaseRepo.Query()
            .Include(x => x.Project)
            .FirstOrDefaultAsync(x => x.PhaseId == request.PhaseId, ct);

        if (phase == null)
            throw new NotFoundException(nameof(Phase), request.PhaseId);

        if (phase.Project?.Status != ProjectStatus.InProgress)
        {
            throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", "Dự án hiện không ở trạng thái hoạt động.");
        }

        if (phase.Status == PhaseStatus.Approved)
            throw new BusinessException("INVALID_STATUS", "Phase này đã được nghiệm thu và hoàn thành trước đó.");

        // 2. Validate all Tasks 100%
        var tasks = await taskRepo.Query()
            .Include(x => x.Assignees)
            .ThenInclude(a => a.User)
            .Where(x => x.PhaseId == request.PhaseId)
            .ToListAsync(ct);

        var nonObsoleteTasks = tasks.Where(t => t.Status != BPG.Domain.Constants.TaskStatus.Obsolete).ToList();

        if (nonObsoleteTasks.Count == 0)
            throw new BusinessException("INVALID_OPERATION", "Không thể nghiệm thu Phase chưa có công việc hoạt động nào.");

        if (nonObsoleteTasks.Any(t => t.ProgressPercent < 100))
            throw new BusinessException("INVALID_OPERATION", "Không thể nghiệm thu Phase khi chưa hoàn thành 100% tất cả các công việc hoạt động.");

        var userId = _currentUserService.GetRequiredUserId();
        var user = await userRepo.GetByIdAsync(userId, ct);
        var currentUserFullName = user?.FullName ?? "Unknown User";

        // 3. Generate PDF
        var pdfModel = new PhaseAcceptancePdfModel
        {
            ProjectName = phase.Project?.Name ?? "Unknown Project",
            PhaseName = phase.Name,
            AcceptedByFullName = currentUserFullName,
            // Ngày in trên biên bản là để người đọc xem nên lấy giờ Việt Nam, khác với
            // AcceptanceDate lưu xuống DB (luôn là UTC).
            AcceptanceDate = VietnamTime.Now,
            ReportContent = request.ReportContent,
            Tasks = nonObsoleteTasks.Select(t => new PhaseAcceptanceTaskDto
            {
                TaskName = t.Name,
                AssigneeName = t.Assignees.FirstOrDefault()?.User?.FullName ?? "Chưa phân công",
                ProgressPercent = t.ProgressPercent
            }).ToList()
        };

        var pdfBytes = _pdfService.GeneratePhaseAcceptancePdf(pdfModel);

        // 4. Upload PDF
        string fileName = $"BienBanNghiemThu_Phase_{phase.PhaseId}_{VietnamTime.Now:yyyyMMddHHmmss}.pdf";
        string pdfUrl = await _fileStorageService.UploadFileAsync(pdfBytes, fileName, StorageFolders.AcceptanceDocs, ct);

        // 5. Save Acceptance (Always insert a new one to keep history)
        var acceptance = new PhaseAcceptance
        {
            PhaseId = phase.PhaseId,
            AcceptedBy = userId,
            AcceptanceDate = DateTime.UtcNow,
            ReportContent = request.ReportContent,
            PdfUrl = pdfUrl,
            IsCancelled = false
        };

        await acceptanceRepo.AddAsync(acceptance, ct);

        // 6. Update Phase Status
        phase.Status = PhaseStatus.Approved;
        phaseRepo.Update(phase);

        await _unitOfWork.SaveChangesAsync(ct);

        // 1. Gửi thông báo đến Giám đốc (trừ người thực hiện)
        await _notificationService.SendNotificationToRoleAsync(
            BPG.Domain.Constants.UserRole.Director,
            "Nghiệm thu hoàn thành giai đoạn",
            $"Giai đoạn '{phase.Name}' của dự án '{phase.Project?.Name}' đã được nghiệm thu và hoàn thành.",
            NotificationType.Progress,
            userId,
            $"/projects/{phase.ProjectId}/phases/{phase.PhaseId}/acceptance",
            acceptance.AcceptanceId,
            ct);

        // 2. Gửi thông báo tới Project Leader (Chỉ huy trưởng) của dự án (trừ người thực hiện)
        var projectLeader = await _unitOfWork.Repository<ProjectMember>().Query()
            .FirstOrDefaultAsync(pm => pm.ProjectId == phase.ProjectId && pm.IsLeader && pm.UserId != userId, ct);
        if (projectLeader != null)
        {
            await _notificationService.SendNotificationAsync(
                projectLeader.UserId,
                "Nghiệm thu hoàn thành giai đoạn",
                $"Giai đoạn '{phase.Name}' của dự án '{phase.Project?.Name}' đã được nghiệm thu.",
                NotificationType.Progress,
                $"/projects/{phase.ProjectId}/phases/{phase.PhaseId}/acceptance",
                acceptance.AcceptanceId,
                ct);
        }

        await _unitOfWork.CommitTransactionAsync(ct);

        return acceptance.AcceptanceId;
    }
}

