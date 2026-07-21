using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Phases.Commands.DeletePhase;

public record DeletePhaseCommand(long PhaseId) : IRequest<ApiResponse>;

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
            throw new BusinessException("ERR_PHASE_APPROVED", "Không thể xóa phase đã nghiệm thu.");
        }

        if (phase.Tasks.Any(t => t.ProgressPercent > 0))
        {
            throw new BusinessException("ERR_PHASE_HAS_IN_PROGRESS_TASKS", "Không thể xóa phase vì đã có task đang được thực hiện (tiến độ > 0%).");
        }

        // Soft delete all tasks inside
        foreach (var task in phase.Tasks)
        {
            _unitOfWork.Repository<ProjectTask>().Remove(task);
        }

        _unitOfWork.Repository<Phase>().Remove(phase);
        await _unitOfWork.SaveChangesAsync(ct);

        return ApiResponse.SuccessResult("Xóa phase thành công.");
    }
}
