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

public record AcceptPhaseCommand(long PhaseId, string ReportContent) : IRequest<long>;

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

    public AcceptPhaseCommandHandler(
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUserService,
        IPdfService pdfService,
        IFileStorageService fileStorageService)
    {
        _unitOfWork = unitOfWork;
        _currentUserService = currentUserService;
        _pdfService = pdfService;
        _fileStorageService = fileStorageService;
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

        if (phase.Status == PhaseStatus.Completed)
            throw new BusinessException("INVALID_STATUS", "Phase này đã được nghiệm thu và hoàn thành trước đó.");

        // 2. Validate all Tasks 100%
        var tasks = await taskRepo.Query()
            .Include(x => x.Assignees)
            .ThenInclude(a => a.User)
            .Where(x => x.PhaseId == request.PhaseId)
            .ToListAsync(ct);

        if (tasks.Count == 0)
            throw new BusinessException("INVALID_OPERATION", "Không thể nghiệm thu Phase chưa có công việc nào.");

        if (tasks.Any(t => t.ProgressPercent < 100))
            throw new BusinessException("INVALID_OPERATION", "Không thể nghiệm thu Phase khi chưa hoàn thành 100% tất cả các công việc.");

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
            Tasks = tasks.Select(t => new PhaseAcceptanceTaskDto
            {
                TaskName = t.Name,
                AssigneeName = t.Assignees.FirstOrDefault()?.User?.FullName ?? "Chưa phân công",
                ProgressPercent = t.ProgressPercent
            }).ToList()
        };

        var pdfBytes = _pdfService.GeneratePhaseAcceptancePdf(pdfModel);

        // 4. Upload PDF
        string fileName = $"BienBanNghiemThu_Phase_{phase.PhaseId}_{DateTime.Now:yyyyMMddHHmmss}.pdf";
        string pdfUrl = await _fileStorageService.UploadFileAsync(pdfBytes, fileName, StorageFolders.AcceptanceDocs, ct);

        // 5. Save Acceptance
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
        phase.Status = PhaseStatus.Completed;
        phaseRepo.Update(phase);

        await _unitOfWork.SaveChangesAsync(ct);

        return acceptance.AcceptanceId;
    }
}
