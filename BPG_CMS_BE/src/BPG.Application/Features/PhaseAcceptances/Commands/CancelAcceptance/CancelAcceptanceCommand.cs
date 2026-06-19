using BPG.Domain.Exceptions;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PhaseAcceptances.Commands.CancelAcceptance;

public record CancelAcceptanceCommand(long AcceptanceId, string CancellationReason) : IRequest<bool>;

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

    public CancelAcceptanceCommandHandler(IUnitOfWork unitOfWork, ICurrentUserService currentUserService)
    {
        _unitOfWork = unitOfWork;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(CancelAcceptanceCommand request, CancellationToken ct)
    {
        var acceptanceRepo = _unitOfWork.Repository<PhaseAcceptance>();
        var phaseRepo = _unitOfWork.Repository<Phase>();

        var acceptance = await acceptanceRepo.Query()
            .Include(x => x.Phase)
            .FirstOrDefaultAsync(x => x.AcceptanceId == request.AcceptanceId, ct);

        if (acceptance == null)
            throw new NotFoundException(nameof(PhaseAcceptance), request.AcceptanceId);

        if (acceptance.IsCancelled)
            throw new BusinessException("INVALID_STATUS", "Biên bản nghiệm thu này đã bị hủy trước đó.");

        // Rule: Only allow cancellation within 7 days
        var daysPassed = (DateTime.Now - acceptance.AcceptanceDate).TotalDays;
        if (daysPassed > 7)
            throw new BusinessException("INVALID_OPERATION", "Chỉ được phép hủy nghiệm thu trong vòng 7 ngày kể từ lúc lập biên bản.");

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

        return true;
    }
}
