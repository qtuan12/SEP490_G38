using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;
using BPG.Domain.Constants;

namespace BPG.Application.Features.Phases.Commands.DeletePhase;

public record DeletePhaseCommand(long PhaseId) : IRequest<ApiResponse>
{
}

public class DeletePhaseCommandHandler : IRequestHandler<DeletePhaseCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeletePhaseCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse> Handle(DeletePhaseCommand request, CancellationToken ct)
    {
        var phase = await _unitOfWork.Repository<Phase>()
            .Query()
            .Include(p => p.Tasks)
            .FirstOrDefaultAsync(p => p.PhaseId == request.PhaseId, ct);

        if (phase == null)
            throw new NotFoundException("Phase", request.PhaseId);

        if (phase.Status == BPG.Domain.Constants.PhaseStatus.Approved)
        {
            throw new BusinessException("ERR_PHASE_APPROVED", "KhÃ´ng thá»ƒ xÃ³a phase Ä‘Ã£ nghiá»‡m thu.");
        }

        if (phase.Tasks.Any(t => t.ProgressPercent > 0))
        {
            throw new BusinessException("ERR_PHASE_HAS_IN_PROGRESS_TASKS", "KhÃ´ng thá»ƒ xÃ³a phase vÃ¬ Ä‘Ã£ cÃ³ task Ä‘ang Ä‘Æ°á»£c thá»±c hiá»‡n (tiáº¿n Ä‘á»™ > 0%).");
        }

        // Soft delete all tasks inside
        foreach (var task in phase.Tasks)
        {
            _unitOfWork.Repository<ProjectTask>().Remove(task);
        }

        _unitOfWork.Repository<Phase>().Remove(phase);
        await _unitOfWork.SaveChangesAsync(ct);

        return ApiResponse.SuccessResult("XÃ³a phase thÃ nh cÃ´ng.");
    }
}

