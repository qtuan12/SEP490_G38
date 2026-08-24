using BPG.Application.Common.Helpers;
using BPG.Application.Common.Models;
using BPG.Application.Features.Phases.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Phases.Handlers;

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
            .Include(p => p.Project)
            .FirstOrDefaultAsync(p => p.PhaseId == request.PhaseId, ct);

        if (phase == null)
            throw new NotFoundException("Phase", request.PhaseId);

        await WbsEditGuard.EnsureProjectAllowsWbsEditAsync(
            _unitOfWork, phase.Project.ProjectId, phase.Project.Status, phase.Project.PauseReason, ct);

        // Check rule: chỉ được sửa khi chưa có task hoặc tất cả task = 0%
        if (phase.Tasks.Any(t => t.ProgressPercent > 0))
        {
            throw new BusinessException("ERR_PHASE_HAS_IN_PROGRESS_TASKS", "Không thể sửa phase vì đã có task đang được thực hiện (tiến độ > 0%).");
        }

        phase.Name = request.Name;
        phase.Description = request.Description;
        phase.OrderIndex = request.OrderIndex;
        phase.StartDate = request.StartDate;
        phase.EndDate = request.EndDate;

        _unitOfWork.Repository<Phase>().Update(phase);
        await _unitOfWork.SaveChangesAsync(ct);

        return ApiResponse.SuccessResult("Cập nhật phase thành công.");
    }
}
