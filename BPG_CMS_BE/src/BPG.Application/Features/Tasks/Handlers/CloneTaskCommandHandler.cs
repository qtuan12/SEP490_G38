using BPG.Application.Common.Helpers;
using BPG.Application.Common.Models;
using BPG.Application.Features.Tasks.Commands;
using BPG.Application.Features.Wbs.Services;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace BPG.Application.Features.Tasks.Handlers;

public class CloneTaskCommandHandler : IRequestHandler<CloneTaskCommand, ApiResponse<long>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUserService;
    private readonly IProjectAccessService _projectAccessService;
    private readonly IProgressRollupService _progressRollupService;
    private readonly WbsCloneFactory _cloneFactory;

    public CloneTaskCommandHandler(
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUserService,
        IProjectAccessService projectAccessService,
        IProgressRollupService progressRollupService,
        WbsCloneFactory cloneFactory)
    {
        _unitOfWork = unitOfWork;
        _currentUserService = currentUserService;
        _projectAccessService = projectAccessService;
        _progressRollupService = progressRollupService;
        _cloneFactory = cloneFactory;
    }

    public async Task<ApiResponse<long>> Handle(CloneTaskCommand request, CancellationToken ct)
    {
        var sourcePhaseId = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .AsNoTracking()
            .Where(task => task.TaskId == request.TaskId)
            .Select(task => (long?)task.PhaseId)
            .FirstOrDefaultAsync(ct);

        if (!sourcePhaseId.HasValue)
            throw new NotFoundException("ProjectTask", request.TaskId);

        await _unitOfWork.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await _unitOfWork.ExecuteSqlAsync(WbsStructureLock.AcquirePhase(sourcePhaseId.Value), ct);

        var source = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .AsNoTracking()
            .Include(task => task.Phase)
                .ThenInclude(phase => phase.Project)
            .FirstOrDefaultAsync(task => task.TaskId == request.TaskId, ct);

        if (source == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        await WbsEditGuard.EnsureProjectAllowsWbsEditAsync(
            _unitOfWork, source.Phase.Project.ProjectId, source.Phase.Project.Status,
            source.Phase.Project.PauseReason, ct, _currentUserService);

        if (source.Phase.Status == PhaseStatus.Approved)
            throw new AlreadyApprovedException("Giai đoạn", source.PhaseId);

        if (source.ParentTaskId.HasValue)
        {
            var parentTask = await _unitOfWork.Repository<ProjectTask>()
                .Query()
                .AsNoTracking()
                .FirstOrDefaultAsync(task => task.TaskId == source.ParentTaskId.Value, ct);
            if (parentTask != null && parentTask.Status == BPG.Domain.Constants.TaskStatus.Obsolete)
            {
                throw new BusinessException(ErrorCodes.InvalidTransition, "Không thể nhân bản công việc khi công việc cha đã bị dừng.");
            }
        }

        if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager)
            && !await _projectAccessService.IsCurrentUserProjectLeaderAsync(
                source.Phase.ProjectId,
                ct))
        {
            throw new ForbiddenException(
                "Chỉ Trưởng dự án hoặc Quản lý kỹ thuật mới được phép nhân bản công việc.");
        }

        var phaseTasks = await _unitOfWork.Repository<ProjectTask>()
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
            .Where(member => member.ProjectId == source.Phase.ProjectId)
            .Select(member => member.UserId)
            .ToListAsync(ct))
            .ToHashSet();

        var maxSiblingOrder = phaseTasks
            .Where(task => task.ParentTaskId == source.ParentTaskId)
            .Select(task => task.OrderIndex)
            .DefaultIfEmpty(0)
            .Max();

        var cloneResult = _cloneFactory.CloneTaskTree(
            phaseTasks,
            source.TaskId,
            maxSiblingOrder + 1,
            projectMemberIds);

        await _unitOfWork.Repository<ProjectTask>().AddRangeAsync(cloneResult.Tasks, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        if (source.ParentTaskId.HasValue)
        {
            await _progressRollupService.RecalculateParentTaskProgressAsync(
                source.ParentTaskId.Value,
                cloneResult.Root.TaskId,
                ct);
            await _unitOfWork.SaveChangesAsync(ct);
        }

        await _unitOfWork.CommitTransactionAsync(ct);

        return ApiResponse<long>.SuccessResult(
            cloneResult.Root.TaskId,
            ResponseMessages.CloneSuccess);
    }
}
