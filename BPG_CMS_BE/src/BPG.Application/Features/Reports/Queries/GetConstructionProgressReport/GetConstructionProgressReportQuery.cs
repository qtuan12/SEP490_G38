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

        var now = DateTime.UtcNow;
        var dateRange = ReportDateRange.Create(request.FromDate, request.ToDate);
        var fromDt = dateRange.From;
        var toDt = dateRange.ToInclusive;
        var reportAsOf = toDt.HasValue && toDt.Value < now ? toDt.Value : now;
        var isHistoricalSnapshot = toDt.HasValue && toDt.Value < now;
        decimal ReportProgress(ProjectTask task) => isHistoricalSnapshot
            ? GetProgressAt(task, reportAsOf)
            : BPG.Application.Common.Helpers.ProgressCalculator.GetEffectiveProgress(task);

        var allTasks = phases.SelectMany(p => p.Tasks).ToList();
        var validTasks = allTasks.Where(t => t.Status != TaskStatus.Obsolete)
            .Where(t => (!fromDt.HasValue || t.EndDate.ToDateTime(TimeOnly.MaxValue) >= fromDt.Value)
                     && (!toDt.HasValue || t.StartDate.ToDateTime(TimeOnly.MinValue) <= toDt.Value))
            .ToList();
        int total = validTasks.Count;
        int done = validTasks.Count(t => ReportProgress(t) >= 100m);
        int inProg = validTasks.Count(t => ReportProgress(t) > 0m && ReportProgress(t) < 100m);
        int assigned = validTasks.Count(t => t.Status == TaskStatus.Assigned);
        int newTasks = validTasks.Count(t => t.Status == TaskStatus.New);
        int obsolete = allTasks.Count(t => t.Status == TaskStatus.Obsolete
            && (!fromDt.HasValue || t.EndDate.ToDateTime(TimeOnly.MaxValue) >= fromDt.Value)
            && (!toDt.HasValue || t.StartDate.ToDateTime(TimeOnly.MinValue) <= toDt.Value));

        decimal overallProgress = CalculateWeightedProgressAt(validTasks, ReportProgress);

        var phaseProgressList = phases.Select(phase =>
        {
            var phaseTasks = phase.Tasks
                .Where(t => t.Status != TaskStatus.Obsolete)
                .Where(t => (!fromDt.HasValue || t.EndDate.ToDateTime(TimeOnly.MaxValue) >= fromDt.Value)
                         && (!toDt.HasValue || t.StartDate.ToDateTime(TimeOnly.MinValue) <= toDt.Value))
                .ToList();
            int ptTotal = phaseTasks.Count;
            int ptDone = phaseTasks.Count(t => ReportProgress(t) >= 100m);
            decimal pProgress = CalculateWeightedProgressAt(phaseTasks, ReportProgress);

            // Phase expected progress calculation using task dates
            decimal expProgress = BPG.Application.Common.Helpers.ProgressCalculator.CalculateWeightedExpectedProgress(phaseTasks, reportAsOf);
            int phaseVarianceDays = 0;
            var overdueTasks = phaseTasks.Where(t => t.EndDate.ToDateTime(TimeOnly.MinValue) < reportAsOf && ReportProgress(t) < 100m).ToList();
            if (overdueTasks.Any())
            {
                phaseVarianceDays = overdueTasks.Max(t => (reportAsOf - t.EndDate.ToDateTime(TimeOnly.MinValue)).Days);
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
                    IsDelayed = t.EndDate.ToDateTime(TimeOnly.MinValue) < reportAsOf
                        && ReportProgress(t) < 100m
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
        decimal overallExpectedProgress = BPG.Application.Common.Helpers.ProgressCalculator.CalculateWeightedExpectedProgress(validTasks, reportAsOf);

        int totalDelayedDays = 0;
        var allOverdueTasks = validTasks.Where(t => t.EndDate.ToDateTime(TimeOnly.MinValue) < reportAsOf && ReportProgress(t) < 100m).ToList();
        if (allOverdueTasks.Any())
        {
            totalDelayedDays = allOverdueTasks.Max(t => (reportAsOf - t.EndDate.ToDateTime(TimeOnly.MinValue)).Days);
        }

        // Forecasted completion date
        string? forecastedEndDateStr = null;
        if (validTasks.Any() && overallProgress > 0)
        {
            var minTaskStart = validTasks.Min(t => t.StartDate.ToDateTime(TimeOnly.MinValue));
            var maxTaskEnd = validTasks.Max(t => t.EndDate.ToDateTime(TimeOnly.MaxValue));
            var elapsedDays = (reportAsOf - minTaskStart).TotalDays;
            if (elapsedDays > 0)
            {
                var currentRate = (double)overallProgress / 100.0;
                var estTotalDays = elapsedDays / currentRate;
                var estEnd = minTaskStart.AddDays(estTotalDays);
                forecastedEndDateStr = estEnd.ToString("dd/MM/yyyy");
            }
            else
            {
                forecastedEndDateStr = maxTaskEnd.ToString("dd/MM/yyyy");
            }
        }

        // Assignee Performance Matrix
        var assigneePerformanceList = validTasks
            .SelectMany(t => t.Assignees.Select(a => new { Task = t, User = a.User }))
            .Where(x => x.User != null)
            .GroupBy(x => x.User!.FullName)
            .Select(g =>
            {
                int totalT = g.Count();
                int doneT = g.Count(x => ReportProgress(x.Task) >= 100m);
                int delayedT = g.Count(x => x.Task.EndDate.ToDateTime(TimeOnly.MinValue) < reportAsOf && ReportProgress(x.Task) < 100m);
                decimal onTimeRate = totalT > 0 ? Math.Round(((decimal)(totalT - delayedT) / totalT) * 100, 1) : 100m;

                return new AssigneePerformanceDto
                {
                    AssigneeName = g.Key,
                    TotalTasks = totalT,
                    CompletedTasks = doneT,
                    DelayedTasks = delayedT,
                    OnTimeRatePercent = onTimeRate
                };
            })
            .OrderByDescending(a => a.TotalTasks)
            .ToList();

        // Analytical Progress Insights
        var insights = new List<string>();
        decimal variancePercent = overallProgress - overallExpectedProgress;

        if (variancePercent >= 0)
        {
            insights.Add($"Tiến độ tổng thể đạt {overallProgress}%, vượt {variancePercent:F1}% so với tiến độ kế hoạch kỳ vọng ({overallExpectedProgress}%).");
        }
        else if (Math.Abs(variancePercent) <= delayThresholdPercent)
        {
            insights.Add($"Tiến độ thực tế ({overallProgress}%) đang chậm {Math.Abs(variancePercent):F1}% so với kế hoạch kỳ vọng ({overallExpectedProgress}%), " +
                         $"vẫn trong ngưỡng cho phép {delayThresholdPercent:F0}%.");
        }
        else
        {
            insights.Add($"Cảnh báo: Tiến độ thực tế ({overallProgress}%) đang chậm {Math.Abs(variancePercent):F1}% so với tiến độ kế hoạch kỳ vọng ({overallExpectedProgress}%), " +
                         $"vượt ngưỡng cho phép {delayThresholdPercent:F0}%.");
        }

        var bottleneckPhase = phaseProgressList
            .Where(p => p.TotalTasks > 0 && p.Status != BPG.Domain.Constants.PhaseStatus.Completed && p.Status != BPG.Domain.Constants.PhaseStatus.Approved)
            .OrderByDescending(p => p.DelayedTasks.Count)
            .ThenBy(p => p.ProgressPercent)
            .FirstOrDefault();

        if (bottleneckPhase != null)
        {
            insights.Add($"Điểm nghẽn thi công chính: Phase '{bottleneckPhase.PhaseName}' mới đạt {bottleneckPhase.ProgressPercent}% (có {bottleneckPhase.DelayedTasks.Count} công việc trễ hạn).");
        }

        if (forecastedEndDateStr != null)
        {
            insights.Add($"Dự báo hoàn thành công trình: Ngày {forecastedEndDateStr} (dựa trên tốc độ thi công hiện tại).");
        }

        if (totalDelayedDays > 0)
        {
            insights.Add($"Đề xuất Ban Quản lý: Cần tăng cường nhân lực & giám sát cho các hạng mục trễ hạn để bù lại {totalDelayedDays} ngày chậm trễ.");
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
            var durDays = Math.Max(1, (int)(e - s).TotalDays + 1);
            return new { Task = t, Start = s, End = e, DurationDays = durDays };
        }).ToList();

        double totalProjectDurationDays = taskWeights.Sum(x => x.DurationDays);
        if (totalProjectDurationDays <= 0) totalProjectDurationDays = 1;

        decimal prevPlannedCumulative = 0m;
        decimal prevActualCumulative = 0m;

        while (currentM <= targetM)
        {
            var mEnd = currentM.AddMonths(1).AddTicks(-1);
            bool isFutureMonth = currentM > new DateTime(reportAsOf.Year, reportAsOf.Month, 1);

            // 1. Calculate Planned Progress % at mEnd (S-Curve Planned)
            double plannedWeightSum = 0;
            foreach (var item in taskWeights)
            {
                double taskWeight = item.DurationDays / totalProjectDurationDays;
                if (mEnd < item.Start)
                {
                    // Not started yet
                }
                else if (mEnd >= item.End)
                {
                    // Should be 100% complete
                    plannedWeightSum += taskWeight * 100.0;
                }
                else
                {
                    // In progress
                    double elapsedDays = Math.Max(1, (mEnd - item.Start).TotalDays + 1);
                    double plannedFrac = Math.Min(1.0, elapsedDays / item.DurationDays);
                    plannedWeightSum += taskWeight * (plannedFrac * 100.0);
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
                    double taskWeight = item.DurationDays / totalProjectDurationDays;
                    var progressAtMonthEnd = GetProgressAt(item.Task, mEnd);
                    if (progressAtMonthEnd >= 100m)
                    {
                        if (mEnd >= item.Start || currentM >= new DateTime(item.Start.Year, item.Start.Month, 1))
                        {
                            actualWeightSum += taskWeight * 100.0;
                        }
                    }
                    else if (mEnd >= item.Start)
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

            int completedInMonth = validTasks.Count(t =>
                GetProgressAt(t, mEnd) >= 100m);

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
            ForecastedEndDate = forecastedEndDateStr,
            Phases = phaseProgressList,
            Acceptances = acceptances,
            AssigneePerformance = assigneePerformanceList,
            ProgressInsights = insights,
            MonthlyTrends = monthlyProgressTrends
        };

        return ApiResponse<ConstructionProgressReportDto>.SuccessResult(dto);
    }

    private static decimal GetProgressAt(ProjectTask task, DateTime asOf)
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

    private static decimal CalculateWeightedProgressAt(
        IEnumerable<ProjectTask> tasks,
        Func<ProjectTask, decimal> progressSelector)
    {
        var list = tasks.ToList();
        if (list.Count == 0) return 0m;

        var totalWeight = list.Sum(BPG.Application.Common.Helpers.ProgressCalculator.GetEffectiveWeight);
        if (totalWeight <= 0m) return 0m;

        return Math.Round(
            list.Sum(t => BPG.Application.Common.Helpers.ProgressCalculator.GetEffectiveWeight(t) * progressSelector(t)) / totalWeight,
            1);
    }
}
