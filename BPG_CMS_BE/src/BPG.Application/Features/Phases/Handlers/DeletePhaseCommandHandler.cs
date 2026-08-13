using BPG.Application.Common.Models;
using BPG.Application.Features.Phases.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Phases.Handlers;

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
            .Include(p => p.Project)
            .FirstOrDefaultAsync(p => p.PhaseId == request.PhaseId, ct);

        if (phase == null)
            throw new NotFoundException("Phase", request.PhaseId);

        if (phase.Project.Status != ProjectStatus.InProgress && phase.Project.Status != ProjectStatus.Draft)
            throw new BusinessException(ErrorCodes.InvalidTransition, "Dự án phải ở trạng thái Nháp hoặc Đang hoạt động để thực hiện thao tác này.");

        if (phase.Status == PhaseStatus.Approved)
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
