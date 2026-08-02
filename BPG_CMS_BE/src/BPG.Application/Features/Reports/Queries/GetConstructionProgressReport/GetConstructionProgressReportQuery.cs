using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Helpers;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TaskStatus = BPG.Domain.Constants.TaskStatus;

namespace BPG.Application.Features.Reports.Queries.GetConstructionProgressReport;

public record GetConstructionProgressReportQuery(long ProjectId, DateTime? FromDate = null, DateTime? ToDate = null)
    : IRequest<ApiResponse<ConstructionProgressReportDto>>;

public class GetConstructionProgressReportQueryHandler
    : IRequestHandler<GetConstructionProgressReportQuery, ApiResponse<ConstructionProgressReportDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProjectAccessService _projectAccessService;

    public GetConstructionProgressReportQueryHandler(
        IUnitOfWork unitOfWork,
        IProjectAccessService projectAccessService)
    {
        _unitOfWork = unitOfWork;
        _projectAccessService = projectAccessService;
    }

    public async Task<ApiResponse<ConstructionProgressReportDto>> Handle(
        GetConstructionProgressReportQuery request, CancellationToken cancellationToken)
    {
        var accessibleIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
        if (request.ProjectId > 0 && !accessibleIds.Contains(request.ProjectId))
        {
            throw new BPG.Domain.Exceptions.BusinessException("ERR_FORBIDDEN", "Bạn không có quyền xem báo cáo của dự án này.");
        }

        var phasesQuery = _unitOfWork.Repository<Phase>()
            .Query()
            .Include(p => p.Tasks)
                .ThenInclude(t => t.Assignees)
                    .ThenInclude(a => a.User)
            .Include(p => p.Acceptances)
                .ThenInclude(a => a.Acceptor)
            .AsNoTracking();

        if (request.ProjectId > 0)
        {
            phasesQuery = phasesQuery.Where(p => p.ProjectId == request.ProjectId);
        }
        else
        {
            phasesQuery = phasesQuery.Where(p => accessibleIds.Contains(p.ProjectId));
        }

        var phases = await phasesQuery
            .OrderBy(p => p.OrderIndex)
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var fromDt = request.FromDate?.Date;
        var toDt = request.ToDate?.Date.AddDays(1).AddTicks(-1);

        var allTasks = phases.SelectMany(p => p.Tasks).ToList();
        var validTasks = allTasks.Where(t => t.Status != TaskStatus.Obsolete)
            .Where(t => (!fromDt.HasValue || t.EndDate.ToDateTime(TimeOnly.MaxValue) >= fromDt.Value)
                     && (!toDt.HasValue || t.StartDate.ToDateTime(TimeOnly.MinValue) <= toDt.Value))
            .ToList();
        int total = validTasks.Count;
        int done = validTasks.Count(t => BPG.Application.Common.Helpers.ProgressCalculator.IsCompleted(t.Status));
        int inProg = validTasks.Count(t => t.Status == TaskStatus.InProgress);
        int assigned = validTasks.Count(t => t.Status == TaskStatus.Assigned);
        int newTasks = validTasks.Count(t => t.Status == TaskStatus.New);
        int obsolete = allTasks.Count(t => t.Status == TaskStatus.Obsolete);

        decimal overallProgress = BPG.Application.Common.Helpers.ProgressCalculator.CalculateWeightedProgress(validTasks);

        var phaseProgressList = phases.Select(phase =>
        {
            var phaseTasks = phase.Tasks.Where(t => t.Status != TaskStatus.Obsolete).ToList();
            int ptTotal = phaseTasks.Count;
            int ptDone = phaseTasks.Count(t => BPG.Application.Common.Helpers.ProgressCalculator.IsCompleted(t.Status));
            decimal pProgress = BPG.Application.Common.Helpers.ProgressCalculator.CalculateWeightedProgress(phaseTasks);

            var allTasksSummary = phaseTasks
                .Select(t => new TaskSummaryDto
                {
                    TaskId = t.TaskId,
                    TaskName = t.Name,
                    Status = t.Status,
                    ProgressPercent = t.ProgressPercent,
                    EndDate = t.EndDate,
                    AssigneeName = t.Assignees.FirstOrDefault()?.User?.FullName,
                    IsDelayed = t.EndDate.ToDateTime(TimeOnly.MinValue) < now
                        && !BPG.Application.Common.Helpers.ProgressCalculator.IsCompleted(t.Status)
                }).ToList();

            var delayedTasks = allTasksSummary.Where(t => t.IsDelayed).ToList();

            return new PhaseProgressDto
            {
                PhaseId = phase.PhaseId,
                PhaseName = phase.Name,
                Status = phase.Status,
                TotalTasks = ptTotal,
                CompletedTasks = ptDone,
                ProgressPercent = pProgress,
                StartDate = phase.StartDate,
                EndDate = phase.EndDate,
                DelayedTasks = delayedTasks,
                AllTasks = allTasksSummary
            };
        }).ToList();

        var acceptances = phases
            .SelectMany(p => p.Acceptances.Select(a => new PhaseAcceptanceSummaryDto
            {
                AcceptanceId = a.AcceptanceId,
                PhaseName = p.Name,
                AcceptanceDate = a.AcceptanceDate,
                AcceptorName = a.Acceptor?.FullName ?? string.Empty,
                IsCancelled = a.IsCancelled,
                CancellationReason = a.CancellationReason
            }))
            .Where(a => (!fromDt.HasValue || a.AcceptanceDate >= fromDt.Value)
                     && (!toDt.HasValue || a.AcceptanceDate <= toDt.Value))
            .OrderByDescending(a => a.AcceptanceDate)
            .ToList();

        var dto = new ConstructionProgressReportDto
        {
            ProjectId = request.ProjectId,
            TotalTasks = total,
            DoneTasks = done,
            InProgressTasks = inProg,
            AssignedTasks = assigned,
            NewTasks = newTasks,
            ObsoleteTasks = obsolete,
            OverallProgressPercent = overallProgress,
            Phases = phaseProgressList,
            Acceptances = acceptances
        };

        return ApiResponse<ConstructionProgressReportDto>.SuccessResult(dto);
    }
}

