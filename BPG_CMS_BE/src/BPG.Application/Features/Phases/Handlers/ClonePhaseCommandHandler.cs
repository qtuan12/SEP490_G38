using BPG.Application.Common.Models;
using BPG.Application.Features.Phases.Commands;
using BPG.Application.Features.Wbs.Services;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace BPG.Application.Features.Phases.Handlers;

public class ClonePhaseCommandHandler : IRequestHandler<ClonePhaseCommand, ApiResponse<long>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUserService;
    private readonly WbsCloneFactory _cloneFactory;

    public ClonePhaseCommandHandler(
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUserService,
        WbsCloneFactory cloneFactory)
    {
        _unitOfWork = unitOfWork;
        _currentUserService = currentUserService;
        _cloneFactory = cloneFactory;
    }

    public async Task<ApiResponse<long>> Handle(ClonePhaseCommand request, CancellationToken ct)
    {
        if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager))
            throw new ForbiddenException("Chỉ Quản lý kỹ thuật mới được phép nhân bản giai đoạn.");

        await _unitOfWork.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await _unitOfWork.ExecuteSqlAsync(WbsStructureLock.AcquireProject(request.ProjectId), ct);

        var source = await _unitOfWork.Repository<Phase>()
            .Query()
            .AsNoTracking()
            .Include(phase => phase.Project)
            .FirstOrDefaultAsync(
                phase => phase.PhaseId == request.PhaseId
                    && phase.ProjectId == request.ProjectId,
                ct);

        if (source == null)
            throw new NotFoundException("Phase", request.PhaseId);

        if (source.Project.Status != ProjectStatus.InProgress
            && source.Project.Status != ProjectStatus.Draft)
        {
            throw new BusinessException(
                ErrorCodes.InvalidTransition,
                "Dự án phải ở trạng thái Nháp hoặc Đang hoạt động để nhân bản giai đoạn.");
        }

        var sourceTasks = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .AsNoTracking()
            .AsSplitQuery()
            .Include(task => task.Assignees)
            .Include(task => task.Dependencies)
            .Where(task => task.PhaseId == source.PhaseId)
            .ToListAsync(ct);

        var projectMemberIds = (await _unitOfWork.Repository<ProjectMember>()
            .Query()
            .AsNoTracking()
            .Where(member => member.ProjectId == source.ProjectId)
            .Select(member => member.UserId)
            .ToListAsync(ct))
            .ToHashSet();

        var maxOrderIndex = await _unitOfWork.Repository<Phase>()
            .Query()
            .AsNoTracking()
            .Where(phase => phase.ProjectId == source.ProjectId)
            .Select(phase => (int?)phase.OrderIndex)
            .MaxAsync(ct) ?? 0;

        var clone = _cloneFactory.ClonePhase(
            source,
            maxOrderIndex + 1,
            sourceTasks,
            projectMemberIds);

        await _unitOfWork.Repository<Phase>().AddAsync(clone, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        await _unitOfWork.CommitTransactionAsync(ct);

        return ApiResponse<long>.SuccessResult(clone.PhaseId, ResponseMessages.CloneSuccess);
    }
}
