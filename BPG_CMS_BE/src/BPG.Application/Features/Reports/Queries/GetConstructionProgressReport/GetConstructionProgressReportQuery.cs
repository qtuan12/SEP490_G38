using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Helpers;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Domain.Constants;
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

        // Ngưỡng cảnh báo trễ tiến độ do quản trị viên cấu hình (SystemConfigs.ExpectedDelayPercent).
        // Chậm hơn kế hoạch nhưng chưa vượt ngưỡng thì chỉ nhắc nhở, vượt ngưỡng mới coi là cảnh báo.
        var delayConfig = await _unitOfWork.Repository<SystemConfig>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.ConfigKey == BPG.Domain.Constants.SystemConfigKeys.ExpectedDelayPercent, cancellationToken);
        decimal delayThresholdPercent = 10m;
        if (delayConfig != null && decimal.TryParse(delayConfig.ConfigValue, out var parsedThreshold))
            delayThresholdPercent = parsedThreshold;

        var phasesQuery = _unitOfWork.Repository<Phase>()
            .Query()
            .Include(p => p.Tasks)
                .ThenInclude(t => t.Assignees)
                    .ThenInclude(a => a.User)
            .Include(p => p.Tasks)
                .ThenInclude(t => t.ProgressLogs)
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

        var now = BPG.Domain.Common.VietnamTime.Now;
        var dateRange = ReportDateRange.Create(request.FromDate, request.ToDate);
        var fromDt = dateRange.From;
        var toDt = dateRange.ToInclusive;
        var reportAsOf = toDt.HasValue && toDt.Value < now ? toDt.Value : now;
        var isHistoricalSnapshot = toDt.HasValue && toDt.Value < now;
        decimal ReportProgress(ProjectTask task) => isHistoricalSnapshot
            ? GetProgressAtLocal(task, reportAsOf)
            : task.ProgressPercent;

        var allTasks = phases.SelectMany(p => p.Tasks).ToList();
        var parentTaskIds = allTasks
            .Where(t => t.ParentTaskId.HasValue)
            .Select(t => t.ParentTaskId!.Value)
            .ToHashSet();
        var leafTasks = allTasks
            .Where(t => !parentTaskIds.Contains(t.TaskId))
            .ToList();
        var validTasks = leafTasks
            .Where(t => t.Status != TaskStatus.Obsolete)
            .ToList();
        int total = validTasks.Count;
        int done = validTasks.Count(t => ReportProgress(t) >= 100m);
        int inProg = validTasks.Count(t => ReportProgress(t) > 0m && ReportProgress(t) < 100m);
        int assigned = validTasks.Count(t => t.Status == TaskStatus.Assigned);
        int newTasks = validTasks.Count(t => t.Status == TaskStatus.New);
        int obsolete = leafTasks.Count(t => t.Status == TaskStatus.Obsolete);

        decimal overallProgress = ProgressCalculator.CalculateWbsWeightedProgress(validTasks, ReportProgress);
        var reportDate = DateOnly.FromDateTime(reportAsOf);

        var phaseProgressList = phases.Select(phase =>
        {
            var phaseTasks = validTasks
                .Where(t => t.PhaseId == phase.PhaseId)
                .ToList();
            int ptTotal = phaseTasks.Count;
            int ptDone = phaseTasks.Count(t => ReportProgress(t) >= 100m);
            decimal pProgress = ProgressCalculator.CalculateWbsWeightedProgress(phaseTasks, ReportProgress);

            // Use the same leaf-task duration weighting as the WBS construction plan.
            decimal expProgress = ProgressCalculator.CalculateWbsWeightedExpectedProgress(phaseTasks, reportAsOf);
            int phaseVarianceDays = 0;
            var overdueTasks = phaseTasks
                .Where(t => t.EndDate < reportDate && ReportProgress(t) < 100m)
                .ToList();
            if (overdueTasks.Any())
            {
                phaseVarianceDays = overdueTasks.Max(t => reportDate.DayNumber - t.EndDate.DayNumber);
            }

            var allTasksSummary = phaseTasks
                .Select(t => new TaskSummaryDto
                {
                    TaskId = t.TaskId,
                    TaskName = t.Name,
                    Status = t.Status,
                    ProgressPercent = decimal.ToInt32(Math.Round(ReportProgress(t))),
                    EndDate = t.EndDate,
                    AssigneeName = t.Assignees.FirstOrDefault()?.User?.FullName,
                    IsDelayed = t.EndDate < reportDate && ReportProgress(t) < 100m
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
                ExpectedProgressPercent = expProgress,
                ScheduleVarianceDays = phaseVarianceDays,
                StartDate = phase.StartDate,
                EndDate = phase.EndDate,
                DelayedTasks = delayedTasks,
                AllTasks = allTasksSummary
            };
        })
        .Where(p => p.TotalTasks > 0 || (!fromDt.HasValue && !toDt.HasValue))
        .ToList();

        // Calculate overall expected progress
        decimal overallExpectedProgress = ProgressCalculator.CalculateWbsWeightedExpectedProgress(validTasks, reportAsOf);

        int totalDelayedDays = 0;
        var allOverdueTasks = validTasks
            .Where(t => t.EndDate < reportDate && ReportProgress(t) < 100m)
            .ToList();
        if (allOverdueTasks.Any())
        {
            totalDelayedDays = allOverdueTasks.Max(t => reportDate.DayNumber - t.EndDate.DayNumber);
        }

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

        // Calculate Monthly Progress Trends (Full Calendar Year T01 -> T12 & Multi-year History)
        var monthlyProgressTrends = new List<MonthlyProgressTrendDto>();
        DateTime startMonth;
        DateTime endMonth;

        var project = request.ProjectId > 0
            ? await _unitOfWork.Repository<Project>().GetByIdAsync(request.ProjectId, cancellationToken)
            : null;
        bool isProjectFinished = project != null && (project.Status == ProjectStatus.Completed || project.Status == ProjectStatus.Closed);

        if (fromDt.HasValue)
        {
            startMonth = fromDt.Value;
            endMonth = toDt ?? now;
        }
        else if (isProjectFinished)
        {
            var earliestTaskDate = validTasks.Any() ? validTasks.Min(t => t.StartDate.Year) : project!.PlannedStart.Year;
            var latestTaskDate = validTasks.Any() ? validTasks.Max(t => t.EndDate.Year) : project!.PlannedEnd.Year;
            int startYear = Math.Min(earliestTaskDate, latestTaskDate);
            int endYear = Math.Max(earliestTaskDate, latestTaskDate);
            startMonth = new DateTime(startYear, 1, 1);
            endMonth = toDt ?? new DateTime(endYear, 12, 31);
        }
        else
        {
            var earliestTaskDate = validTasks.Any() ? validTasks.Min(t => t.StartDate.ToDateTime(TimeOnly.MinValue)) : now;
            int startYear = Math.Min(earliestTaskDate.Year, now.Year);
            startMonth = new DateTime(startYear, 1, 1);
            endMonth = toDt ?? new DateTime(now.Year, 12, 31);
        }

        var currentM = new DateTime(startMonth.Year, startMonth.Month, 1);
        var targetM = new DateTime(endMonth.Year, endMonth.Month, 1);

        var taskWeights = validTasks.Select(t =>
        {
            var s = t.StartDate.ToDateTime(TimeOnly.MinValue);
            var e = t.EndDate.ToDateTime(TimeOnly.MaxValue);
            return new { Task = t, Start = s, End = e, Weight = ProgressCalculator.GetWbsEffectiveWeight(t) };
        }).ToList();

        decimal totalProjectWeight = taskWeights.Sum(x => x.Weight);
        if (totalProjectWeight <= 0m) totalProjectWeight = 1m;

        decimal prevPlannedCumulative = 0m;
        decimal prevActualCumulative = 0m;

        while (currentM <= targetM)
        {
            var mEnd = currentM.AddMonths(1).AddTicks(-1);
            bool isFutureMonth = currentM > new DateTime(reportAsOf.Year, reportAsOf.Month, 1);
            bool isReportMonth = currentM.Year == reportAsOf.Year && currentM.Month == reportAsOf.Month;
            var plannedAsOf = isReportMonth ? reportAsOf : mEnd;
            var actualAsOf = mEnd < reportAsOf ? mEnd : reportAsOf;

            // 1. Calculate Planned Progress % at mEnd (S-Curve Planned)
            double plannedWeightSum = 0;
            foreach (var item in taskWeights)
            {
                double taskWeight = (double)(item.Weight / totalProjectWeight);
                if (plannedAsOf < item.Start)
                {
                    // Not started yet
                }
                else if (plannedAsOf >= item.End)
                {
                    // Should be 100% complete
                    plannedWeightSum += taskWeight * 100.0;
                }
                else
                {
                    // In progress
                    var expectedProgress = BPG.Application.Common.Helpers.ProgressCalculator
                        .CalculateExpectedTaskProgress(item.Task, plannedAsOf);
                    plannedWeightSum += taskWeight * (double)expectedProgress;
                }
            }
            decimal plannedCumulative = Math.Round((decimal)plannedWeightSum, 1);

            // 2. Calculate Actual Progress % at mEnd (S-Curve Actual)
            decimal actualCumulative = 0m;
            if (!isFutureMonth)
            {
                double actualWeightSum = 0;
                foreach (var item in taskWeights)
                {
                    double taskWeight = (double)(item.Weight / totalProjectWeight);
                    var progressAtMonthEnd = GetProgressAtLocal(item.Task, actualAsOf);
                    if (progressAtMonthEnd >= 100m)
                    {
                        if (actualAsOf >= item.Start || currentM >= new DateTime(item.Start.Year, item.Start.Month, 1))
                        {
                            actualWeightSum += taskWeight * 100.0;
                        }
                    }
                    else if (actualAsOf >= item.Start)
                    {
                        actualWeightSum += taskWeight * (double)progressAtMonthEnd;
                    }
                }
                actualCumulative = Math.Round((decimal)actualWeightSum, 1);
            }
            else
            {
                actualCumulative = prevActualCumulative;
            }

            decimal plannedMonthlyVol = Math.Max(0m, plannedCumulative - prevPlannedCumulative);
            decimal actualMonthlyVol = !isFutureMonth ? Math.Max(0m, actualCumulative - prevActualCumulative) : 0m;

            int completedInMonth = !isFutureMonth
                ? validTasks.Count(t => GetProgressAtLocal(t, actualAsOf) >= 100m)
                : 0;

            monthlyProgressTrends.Add(new MonthlyProgressTrendDto
            {
                Year = currentM.Year,
                Month = currentM.Month,
                MonthLabel = $"T{currentM.Month:D2}/{currentM.Year}",
                CompletedTasksCount = completedInMonth,
                AccumulatedProgressPercent = actualCumulative,
                PlannedProgressPercent = plannedCumulative,
                ActualProgressPercent = actualCumulative,
                PlannedMonthlyVolume = Math.Round(plannedMonthlyVol, 1),
                ActualMonthlyVolume = Math.Round(actualMonthlyVol, 1),
                IsFuture = isFutureMonth
            });

            prevPlannedCumulative = plannedCumulative;
            prevActualCumulative = actualCumulative;
            currentM = currentM.AddMonths(1);
        }

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
            ExpectedProgressPercent = overallExpectedProgress,
            ScheduleVarianceDays = totalDelayedDays,
            DelayWarningThresholdPercent = delayThresholdPercent,
            Phases = phaseProgressList,
            Acceptances = acceptances,
            MonthlyTrends = monthlyProgressTrends
        };

        return ApiResponse<ConstructionProgressReportDto>.SuccessResult(dto);
    }

    private static decimal GetProgressAtLocal(ProjectTask task, DateTime localAsOf)
    {
        var utcAsOf = DateTime.SpecifyKind(
            localAsOf - BPG.Domain.Common.VietnamTime.Offset,
            DateTimeKind.Utc);
        return GetProgressAtUtc(task, utcAsOf);
    }

    private static decimal GetProgressAtUtc(ProjectTask task, DateTime asOf)
    {
        var latestLog = task.ProgressLogs
            .Where(log => log.UpdatedAt <= asOf)
            .OrderByDescending(log => log.UpdatedAt)
            .FirstOrDefault();

        if (latestLog != null)
        {
            return latestLog.NewProgress;
        }

        if (task.CreatedAt <= asOf)
        {
            if (BPG.Application.Common.Helpers.ProgressCalculator.IsCompleted(task.Status)
                && (!task.UpdatedAt.HasValue || task.UpdatedAt.Value <= asOf))
            {
                return 100m;
            }

            return 0m;
        }

        return 0m;
    }

}
