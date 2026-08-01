using BPG.Application.Common.Helpers;
using BPG.Application.Common.Models;
using BPG.Application.IServices;
using BPG.Application.DTOs.Reports;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TaskStatus = BPG.Domain.Constants.TaskStatus;

namespace BPG.Application.Features.Reports.Queries.GetExecutiveDashboard;

public record GetExecutiveDashboardQuery(long ProjectId, DateTime? FromDate = null, DateTime? ToDate = null)
    : IRequest<ApiResponse<ExecutiveDashboardDto>>;

public class GetExecutiveDashboardQueryHandler : IRequestHandler<GetExecutiveDashboardQuery, ApiResponse<ExecutiveDashboardDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProjectAccessService _projectAccessService;

    public GetExecutiveDashboardQueryHandler(IUnitOfWork unitOfWork, IProjectAccessService projectAccessService)
    {
        _unitOfWork = unitOfWork;
        _projectAccessService = projectAccessService;
    }

    public async Task<ApiResponse<ExecutiveDashboardDto>> Handle(GetExecutiveDashboardQuery request, CancellationToken cancellationToken)
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

        var fromDt = request.FromDate?.Date;
        var toDt = request.ToDate?.Date.AddDays(1).AddTicks(-1);

        var allTasks = phases.SelectMany(p => p.Tasks)
            .Where(t => t.Status != TaskStatus.Obsolete)
            .Where(t => (!fromDt.HasValue || t.EndDate.ToDateTime(TimeOnly.MaxValue) >= fromDt.Value)
                     && (!toDt.HasValue || t.StartDate.ToDateTime(TimeOnly.MinValue) <= toDt.Value))
            .ToList();

        int totalTasks = allTasks.Count;
        int completedTasks = allTasks.Count(t => ProgressCalculator.IsCompleted(t.Status));
        int inProgressTasks = allTasks.Count(t => ProgressCalculator.IsInProgress(t.Status));

        var now = DateTime.UtcNow;
        var currentDate = now.Date;

        int delayedTasks = allTasks.Count(t =>
            t.EndDate.ToDateTime(TimeOnly.MinValue) < now &&
            !ProgressCalculator.IsCompleted(t.Status));

        int atRiskTasks = 0;
        var atRiskTaskInfos = new List<DelayedTaskInfoDto>();
        var delayedTaskInfos = new List<DelayedTaskInfoDto>();

        foreach (var t in allTasks.Where(t => !ProgressCalculator.IsCompleted(t.Status) && t.StartDate.ToDateTime(TimeOnly.MinValue) <= now))
        {
            var endDt = t.EndDate.ToDateTime(TimeOnly.MinValue);
            bool isDelayed = endDt < now;

            if (isDelayed)
            {
                var phaseName = phases.FirstOrDefault(p => p.Tasks.Any(task => task.TaskId == t.TaskId))?.Name ?? string.Empty;
                delayedTaskInfos.Add(new DelayedTaskInfoDto
                {
                    TaskId = t.TaskId,
                    TaskName = t.Name,
                    PhaseName = phaseName,
                    ProgressPercent = t.ProgressPercent,
                    EndDate = t.EndDate,
                    AssigneeName = t.Assignees.FirstOrDefault()?.User?.FullName,
                    WarningType = "Red"
                });
                continue;
            }

            // At risk: ≤ 3 days left and behind schedule by 20%+
            var daysLeft = (endDt - now).TotalDays;
            if (daysLeft <= 3)
            {
                var totalDuration = (endDt - t.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;
                var elapsed = (currentDate - t.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;

                if (totalDuration > 0)
                {
                    var expectedProgress = (elapsed / totalDuration) * 100;
                    if (t.ProgressPercent < expectedProgress - 20)
                    {
                        atRiskTasks++;
                        var phaseName = phases.FirstOrDefault(p => p.Tasks.Any(task => task.TaskId == t.TaskId))?.Name ?? string.Empty;
                        atRiskTaskInfos.Add(new DelayedTaskInfoDto
                        {
                            TaskId = t.TaskId,
                            TaskName = t.Name,
                            PhaseName = phaseName,
                            ProgressPercent = t.ProgressPercent,
                            EndDate = t.EndDate,
                            AssigneeName = t.Assignees.FirstOrDefault()?.User?.FullName,
                            WarningType = "Yellow"
                        });
                    }
                }
            }
        }

        // Phase breakdown with weighted progress
        var phaseBreakdown = phases.Select(phase =>
        {
            var phaseTasks = phase.Tasks.Where(t => t.Status != TaskStatus.Obsolete).ToList();
            int ptTotal = phaseTasks.Count;
            int ptDone = phaseTasks.Count(t => ProgressCalculator.IsCompleted(t.Status));
            decimal pProgress = BPG.Application.Common.Helpers.ProgressCalculator.CalculateWeightedProgress(phaseTasks);

            return new PhaseProgressSummaryDto
            {
                PhaseId = phase.PhaseId,
                PhaseName = phase.Name,
                Status = phase.Status,
                TotalTasks = ptTotal,
                CompletedTasks = ptDone,
                ProgressPercent = pProgress
            };
        }).ToList();

        // BOQ exceeded logic
        var mrQuery = _unitOfWork.Repository<MaterialRequest>()
            .Query()
            .Include(mr => mr.Phase)
            .Include(mr => mr.Items)
            .Where(mr => mr.Items.Any(i => i.IsOverBOQ));

        if (request.ProjectId > 0)
        {
            mrQuery = mrQuery.Where(mr => mr.Phase!.ProjectId == request.ProjectId);
        }
        else
        {
            mrQuery = mrQuery.Where(mr => accessibleIds.Contains(mr.Phase!.ProjectId));
        }

        if (fromDt.HasValue)
        {
            mrQuery = mrQuery.Where(mr => mr.CreatedAt >= fromDt.Value);
        }
        if (toDt.HasValue)
        {
            mrQuery = mrQuery.Where(mr => mr.CreatedAt <= toDt.Value);
        }

        var overBoqMRs = await mrQuery.CountAsync(cancellationToken);

        var allDelayedInfos = delayedTaskInfos
            .Concat(atRiskTaskInfos)
            .OrderBy(t => t.WarningType == "Red" ? 0 : 1)
            .ThenBy(t => t.EndDate)
            .Take(20)
            .ToList();

        var dto = new ExecutiveDashboardDto
        {
            ProjectId = request.ProjectId,
            TotalTasks = totalTasks,
            CompletedTasks = completedTasks,
            InProgressTasks = inProgressTasks,
            DelayedTasks = delayedTasks,
            AtRiskTasks = atRiskTasks,
            OverBoqMaterialRequests = overBoqMRs,
            MaterialsExceedingBOQ = overBoqMRs,
            PhaseBreakdown = phaseBreakdown,
            DelayedTasksList = allDelayedInfos
        };

        return ApiResponse<ExecutiveDashboardDto>.SuccessResult(dto);
    }
}

