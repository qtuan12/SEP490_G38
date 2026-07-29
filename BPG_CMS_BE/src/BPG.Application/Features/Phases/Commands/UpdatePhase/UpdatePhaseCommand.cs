using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;
using BPG.Domain.Constants;

namespace BPG.Application.Features.Phases.Commands.UpdatePhase;

public record UpdatePhaseCommand(
    long PhaseId,
    string Name,
    string? Description,
    int OrderIndex,
    DateOnly? StartDate,
    DateOnly? EndDate,
    int Status
) : IRequest<ApiResponse>
{
}

public class UpdatePhaseCommandValidator : AbstractValidator<UpdatePhaseCommand>
{
    public UpdatePhaseCommandValidator()
    {
        RuleFor(x => x.PhaseId).GreaterThan(0);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.OrderIndex).GreaterThanOrEqualTo(0);
        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.StartDate)
            .When(x => x.StartDate.HasValue && x.EndDate.HasValue)
            .WithMessage("NgÃ y káº¿t thÃºc khÃ´ng Ä‘Æ°á»£c nhá» hÆ¡n ngÃ y báº¯t Ä‘áº§u.");
    }
}

public class UpdatePhaseCommandHandler : IRequestHandler<UpdatePhaseCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdatePhaseCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse> Handle(UpdatePhaseCommand request, CancellationToken ct)
    {
        var phase = await _unitOfWork.Repository<Phase>()
            .Query()
            .Include(p => p.Tasks)
            .FirstOrDefaultAsync(p => p.PhaseId == request.PhaseId, ct);

        if (phase == null)
            throw new NotFoundException("Phase", request.PhaseId);

        // Check rule: chá»‰ Ä‘Æ°á»£c sá»­a khi chÆ°a cÃ³ task hoáº·c táº¥t cáº£ task = 0%
        if (phase.Tasks.Any(t => t.ProgressPercent > 0))
        {
            throw new BusinessException("ERR_PHASE_HAS_IN_PROGRESS_TASKS", "KhÃ´ng thá»ƒ sá»­a phase vÃ¬ Ä‘Ã£ cÃ³ task Ä‘ang Ä‘Æ°á»£c thá»±c hiá»‡n (tiáº¿n Ä‘á»™ > 0%).");
        }

        phase.Name = request.Name;
        phase.Description = request.Description;
        phase.OrderIndex = request.OrderIndex;
        phase.StartDate = request.StartDate;
        phase.EndDate = request.EndDate;

        _unitOfWork.Repository<Phase>().Update(phase);
        await _unitOfWork.SaveChangesAsync(ct);

        return ApiResponse.SuccessResult("Cáº­p nháº­t phase thÃ nh cÃ´ng.");
    }
}

