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

public class CreatePhaseCommandHandler : IRequestHandler<CreatePhaseCommand, ApiResponse<long>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreatePhaseCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse<long>> Handle(CreatePhaseCommand request, CancellationToken ct)
    {
        var project = await _unitOfWork.Repository<Project>()
            .Query()
            .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, ct);

        if (project == null)
            throw new NotFoundException("Project", request.ProjectId);

        await WbsEditGuard.EnsureProjectAllowsWbsEditAsync(
            _unitOfWork, project.ProjectId, project.Status, project.PauseReason, ct);

        if (request.StartDate.HasValue && request.StartDate.Value < project.PlannedStart)
        {
            throw new BusinessException("ERR_PHASE_DATE_INVALID", $"Ngày bắt đầu của giai đoạn ({request.StartDate.Value:dd/MM/yyyy}) không được trước ngày bắt đầu của dự án ({project.PlannedStart:dd/MM/yyyy}).");
        }

        if (request.EndDate.HasValue && request.EndDate.Value > project.PlannedEnd)
        {
            throw new BusinessException("ERR_PHASE_DATE_INVALID", $"Ngày kết thúc của giai đoạn ({request.EndDate.Value:dd/MM/yyyy}) không được sau ngày kết thúc của dự án ({project.PlannedEnd:dd/MM/yyyy}).");
        }

        var phase = new Phase
        {
            ProjectId = request.ProjectId,
            Name = request.Name,
            Description = request.Description,
            OrderIndex = request.OrderIndex,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Status = PhaseStatus.Draft
        };

        await _unitOfWork.Repository<Phase>().AddAsync(phase);
        await _unitOfWork.SaveChangesAsync(ct);

        return ApiResponse<long>.SuccessResult(phase.PhaseId, "Tạo phase thành công.");
    }
}
