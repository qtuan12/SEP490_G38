using BPG.Application.Common.Helpers;
using BPG.Application.Common.Models;
using BPG.Application.IServices;
using BPG.Application.DTOs.Reports;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Constants;
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
            .Include(p => p.Tasks)
                .ThenInclude(t => t.ProgressLogs)
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

        var dateRange = ReportDateRange.Create(request.FromDate, request.ToDate);
        var fromDt = dateRange.From;
        var toDt = dateRange.ToInclusive;

        var allProjectTasks = phases.SelectMany(p => p.Tasks).ToList();
        var parentTaskIds = allProjectTasks
            .Where(t => t.ParentTaskId.HasValue)
            .Select(t => t.ParentTaskId!.Value)
            .ToHashSet();
        var allTasks = allProjectTasks
            .Where(t => !parentTaskIds.Contains(t.TaskId) && t.Status != TaskStatus.Obsolete)
            .ToList();

        var now = DateTime.UtcNow;
        var reportAsOf = toDt.HasValue && toDt.Value < now ? toDt.Value : now;
        var isHistoricalSnapshot = toDt.HasValue && toDt.Value < now;
        decimal ReportProgress(ProjectTask task) => isHistoricalSnapshot
            ? GetProgressAt(task, reportAsOf)
            : ProgressCalculator.GetEffectiveProgress(task);

        int totalTasks = allTasks.Count;
        int completedTasks = allTasks.Count(t => ReportProgress(t) >= 100m);
        int inProgressTasks = allTasks.Count(t => ReportProgress(t) > 0m && ReportProgress(t) < 100m);
        var currentDate = reportAsOf.Date;

        int delayedTasks = allTasks.Count(t =>
            t.EndDate.ToDateTime(TimeOnly.MinValue) < reportAsOf &&
            ReportProgress(t) < 100m);

        int atRiskTasks = 0;
        var atRiskTaskInfos = new List<DelayedTaskInfoDto>();
        var delayedTaskInfos = new List<DelayedTaskInfoDto>();

        foreach (var t in allTasks.Where(t => ReportProgress(t) < 100m && t.StartDate.ToDateTime(TimeOnly.MinValue) <= reportAsOf))
        {
            var taskProgress = ReportProgress(t);
            var endDt = t.EndDate.ToDateTime(TimeOnly.MinValue);
            bool isDelayed = endDt < reportAsOf;

            if (isDelayed)
            {
                var phaseName = phases.FirstOrDefault(p => p.Tasks.Any(task => task.TaskId == t.TaskId))?.Name ?? string.Empty;
                delayedTaskInfos.Add(new DelayedTaskInfoDto
                {
                    TaskId = t.TaskId,
                    TaskName = t.Name,
                    PhaseName = phaseName,
                    ProgressPercent = decimal.ToInt32(Math.Round(taskProgress)),
                    EndDate = t.EndDate,
                    AssigneeName = t.Assignees.FirstOrDefault()?.User?.FullName,
                    WarningType = "Red"
                });
                continue;
            }

            // At risk: ≤ 3 days left and behind schedule by 20%+
            var daysLeft = (endDt - reportAsOf).TotalDays;
            if (daysLeft <= 3)
            {
                var totalDuration = (endDt - t.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;
                var elapsed = (currentDate - t.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;

                if (totalDuration > 0)
                {
                    var expectedProgress = (elapsed / totalDuration) * 100;
                    if (taskProgress < (decimal)expectedProgress - 20m)
                    {
                        atRiskTasks++;
                        var phaseName = phases.FirstOrDefault(p => p.Tasks.Any(task => task.TaskId == t.TaskId))?.Name ?? string.Empty;
                        atRiskTaskInfos.Add(new DelayedTaskInfoDto
                        {
                            TaskId = t.TaskId,
                            TaskName = t.Name,
                            PhaseName = phaseName,
                            ProgressPercent = decimal.ToInt32(Math.Round(taskProgress)),
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
            var phaseTasks = allTasks
                .Where(t => t.PhaseId == phase.PhaseId)
                .ToList();
            int ptTotal = phaseTasks.Count;
            int ptDone = phaseTasks.Count(t => ReportProgress(t) >= 100m);
            decimal pProgress = ProgressCalculator.CalculateWbsWeightedProgress(phaseTasks, ReportProgress);

            return new PhaseProgressSummaryDto
            {
                PhaseId = phase.PhaseId,
                PhaseName = phase.Name,
                Status = phase.Status,
                TotalTasks = ptTotal,
                CompletedTasks = ptDone,
                ProgressPercent = pProgress
            };
        })
        .Where(p => p.TotalTasks > 0 || (!fromDt.HasValue && !toDt.HasValue))
        .ToList();

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

        var overBoqMaterialCount = await mrQuery
            .SelectMany(mr => mr.Items.Where(i => i.IsOverBOQ))
            .Select(i => i.MaterialId)
            .Distinct()
            .CountAsync(cancellationToken);

        var overBoqMRs = await mrQuery.CountAsync(cancellationToken);

        var allDelayedInfos = delayedTaskInfos
            .Concat(atRiskTaskInfos)
            .OrderBy(t => t.WarningType == "Red" ? 0 : 1)
            .ThenBy(t => t.EndDate)
            .Take(20)
            .ToList();

        // 1. Period Comparison Calculation
        DateTime curEnd = toDt ?? now;
        DateTime curStart = fromDt ?? curEnd.Date.AddDays(-29);
        int periodLengthDays = Math.Max(1, (curEnd.Date - curStart.Date).Days + 1);
        DateTime prevStart = curStart.AddDays(-periodLengthDays);
        DateTime prevEnd = curStart.AddTicks(-1);

        int curCompletedTasks = phases.SelectMany(p => p.Tasks)
            .Where(t => t.Status != TaskStatus.Obsolete)
            .Count(t => t.UpdatedAt >= curStart && t.UpdatedAt <= curEnd && ProgressCalculator.IsCompleted(t.Status));

        int prevCompletedTasks = phases.SelectMany(p => p.Tasks)
            .Where(t => t.Status != TaskStatus.Obsolete)
            .Where(t => t.UpdatedAt >= prevStart && t.UpdatedAt <= prevEnd && ProgressCalculator.IsCompleted(t.Status))
            .Count();

        int prevIncidentsCount = await _unitOfWork.Repository<Incident>()
            .Query()
            .Where(i => (request.ProjectId > 0
                    ? i.ProjectId == request.ProjectId
                    : accessibleIds.Contains(i.ProjectId))
                && i.CreatedAt >= prevStart
                && i.CreatedAt <= prevEnd)
            .CountAsync(cancellationToken);

        int curIncidentsCount = await _unitOfWork.Repository<Incident>()
            .Query()
            .Where(i => (request.ProjectId > 0
                    ? i.ProjectId == request.ProjectId
                    : accessibleIds.Contains(i.ProjectId))
                && (!fromDt.HasValue || i.CreatedAt >= fromDt.Value)
                && (!toDt.HasValue || i.CreatedAt <= toDt.Value))
            .CountAsync(cancellationToken);

        // Submitted emergency purchases create FullyReceived technical POs before
        // payment approval. Exclude every such PO from normal PO totals and add back
        // only source Direct Purchases that have actually been Approved.
        var autoPoQuery = _unitOfWork.Repository<DirectPurchaseRequest>()
            .Query()
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(dp => dp.AutoPOId.HasValue);
        autoPoQuery = request.ProjectId > 0
            ? autoPoQuery.Where(dp => dp.ProjectId == request.ProjectId)
            : autoPoQuery.Where(dp => accessibleIds.Contains(dp.ProjectId));
        var autoPoIds = await autoPoQuery
            .Select(dp => dp.AutoPOId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

        decimal prevPoCost = await _unitOfWork.Repository<PurchaseOrder>()
            .Query()
            .Where(po => po.Status != PurchaseOrderStatus.Draft
                      && po.Status != PurchaseOrderStatus.PendingApproval
                      && po.Status != PurchaseOrderStatus.Rejected
                      && po.Status != PurchaseOrderStatus.Cancelled
                      && !autoPoIds.Contains(po.POId))
            .Where(po => (request.ProjectId > 0
                    ? po.ProjectId == request.ProjectId
                    : accessibleIds.Contains(po.ProjectId))
                && po.OrderDate >= prevStart
                && po.OrderDate <= prevEnd)
            .SumAsync(po => (decimal?)po.TotalAmount, cancellationToken) ?? 0m;

        var approvedDirectPurchaseCostQuery = _unitOfWork.Repository<DirectPurchaseRequest>()
            .Query()
            .Where(dp => dp.Status == DirectPurchaseStatus.Approved)
            .Where(dp => request.ProjectId > 0
                ? dp.ProjectId == request.ProjectId
                : accessibleIds.Contains(dp.ProjectId));
        var prevDirectPurchaseAmounts = await approvedDirectPurchaseCostQuery
            .Where(dp => dp.PurchaseDate >= prevStart && dp.PurchaseDate <= prevEnd)
            .Select(dp => dp.TotalAmount > 0
                ? dp.TotalAmount
                : dp.Items.Sum(item => item.Quantity * item.UnitPrice))
            .ToListAsync(cancellationToken);
        decimal prevDirectPurchaseCost = prevDirectPurchaseAmounts.Sum();

        decimal curPoCost = await _unitOfWork.Repository<PurchaseOrder>()
            .Query()
            .Where(po => po.Status != PurchaseOrderStatus.Draft
                      && po.Status != PurchaseOrderStatus.PendingApproval
                      && po.Status != PurchaseOrderStatus.Rejected
                      && po.Status != PurchaseOrderStatus.Cancelled
                      && !autoPoIds.Contains(po.POId))
            .Where(po => (request.ProjectId > 0
                    ? po.ProjectId == request.ProjectId
                    : accessibleIds.Contains(po.ProjectId))
                && (!fromDt.HasValue || po.OrderDate >= fromDt.Value)
                && (!toDt.HasValue || po.OrderDate <= toDt.Value))
            .SumAsync(po => (decimal?)po.TotalAmount, cancellationToken) ?? 0m;

        var curDirectPurchaseAmounts = await approvedDirectPurchaseCostQuery
            .Where(dp => (!fromDt.HasValue || dp.PurchaseDate >= fromDt.Value)
                && (!toDt.HasValue || dp.PurchaseDate <= toDt.Value))
            .Select(dp => dp.TotalAmount > 0
                ? dp.TotalAmount
                : dp.Items.Sum(item => item.Quantity * item.UnitPrice))
            .ToListAsync(cancellationToken);
        decimal curDirectPurchaseCost = curDirectPurchaseAmounts.Sum();

        decimal prevProcurementCost = prevPoCost + prevDirectPurchaseCost;
        decimal curProcurementCost = curPoCost + curDirectPurchaseCost;

        int prevOverBoqMRs = await _unitOfWork.Repository<MaterialRequest>()
            .Query()
            .Where(mr => mr.Items.Any(i => i.IsOverBOQ))
            .Where(mr => (request.ProjectId > 0
                    ? mr.Phase!.ProjectId == request.ProjectId
                    : accessibleIds.Contains(mr.Phase!.ProjectId))
                && mr.CreatedAt >= prevStart
                && mr.CreatedAt <= prevEnd)
            .CountAsync(cancellationToken);

        decimal completedDelta = prevCompletedTasks > 0 ? Math.Round(((decimal)(curCompletedTasks - prevCompletedTasks) / prevCompletedTasks) * 100, 1) : (curCompletedTasks > 0 ? 100m : 0m);
        decimal incidentsDelta = prevIncidentsCount > 0 ? Math.Round(((decimal)(curIncidentsCount - prevIncidentsCount) / prevIncidentsCount) * 100, 1) : (curIncidentsCount > 0 ? 100m : 0m);
        decimal costDelta = prevProcurementCost > 0
            ? Math.Round(((curProcurementCost - prevProcurementCost) / prevProcurementCost) * 100, 1)
            : (curProcurementCost > 0 ? 100m : 0m);

        var periodComparison = new PeriodComparisonMetricsDto
        {
            CurrentCompletedTasks = curCompletedTasks,
            PreviousCompletedTasks = prevCompletedTasks,
            CompletedTasksDeltaPercent = completedDelta,
            CurrentIncidents = curIncidentsCount,
            PreviousIncidents = prevIncidentsCount,
            IncidentsDeltaPercent = incidentsDelta,
            CurrentProcurementCost = curProcurementCost,
            PreviousProcurementCost = prevProcurementCost,
            ProcurementCostDeltaPercent = costDelta,
            CurrentOverBoqMRs = overBoqMRs,
            PreviousOverBoqMRs = prevOverBoqMRs
        };

        // 2. Cross Project Comparison Matrix
        var crossProjectMatrix = new List<ProjectComparisonMatrixItemDto>();
        var allAccessibleProjects = await _unitOfWork.Repository<Project>()
            .Query()
            .Where(p => accessibleIds.Contains(p.ProjectId) && p.Status != ProjectStatus.Draft)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var comparisonPhases = request.ProjectId > 0
            ? await _unitOfWork.Repository<Phase>()
                .Query()
                .Include(p => p.Tasks)
                    .ThenInclude(t => t.ProgressLogs)
                .Where(p => accessibleIds.Contains(p.ProjectId))
                .AsNoTracking()
                .ToListAsync(cancellationToken)
            : phases;

        var matrixMrQuery = _unitOfWork.Repository<MaterialRequest>()
            .Query()
            .Where(mr => accessibleIds.Contains(mr.Phase!.ProjectId) && mr.Items.Any(i => i.IsOverBOQ));
        if (fromDt.HasValue) matrixMrQuery = matrixMrQuery.Where(mr => mr.CreatedAt >= fromDt.Value);
        if (toDt.HasValue) matrixMrQuery = matrixMrQuery.Where(mr => mr.CreatedAt <= toDt.Value);
        var overBoqByProject = await matrixMrQuery
            .GroupBy(mr => mr.Phase!.ProjectId)
            .Select(g => new { ProjectId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ProjectId, x => x.Count, cancellationToken);

        var matrixIncidentQuery = _unitOfWork.Repository<Incident>()
            .Query()
            .Where(i => accessibleIds.Contains(i.ProjectId));
        if (fromDt.HasValue) matrixIncidentQuery = matrixIncidentQuery.Where(i => i.CreatedAt >= fromDt.Value);
        if (toDt.HasValue) matrixIncidentQuery = matrixIncidentQuery.Where(i => i.CreatedAt <= toDt.Value);
        var incidentsByProject = await matrixIncidentQuery
            .GroupBy(i => i.ProjectId)
            .Select(g => new
            {
                ProjectId = g.Key,
                Count = g.Count(),
                Loss = g.Sum(i => i.EstimatedMaterialLoss ?? 0m)
            })
            .ToDictionaryAsync(x => x.ProjectId, cancellationToken);

        foreach (var proj in allAccessibleProjects)
        {
            var pPhases = comparisonPhases.Where(p => p.ProjectId == proj.ProjectId).ToList();
            var projectTasks = pPhases.SelectMany(p => p.Tasks).ToList();
            var projectParentTaskIds = projectTasks
                .Where(t => t.ParentTaskId.HasValue)
                .Select(t => t.ParentTaskId!.Value)
                .ToHashSet();
            var pTasks = projectTasks
                .Where(t => !projectParentTaskIds.Contains(t.TaskId) && t.Status != TaskStatus.Obsolete)
                .ToList();
            decimal pProg = ProgressCalculator.CalculateWbsWeightedProgress(pTasks, ReportProgress);
            int pTotal = pTasks.Count;
            int pDelayed = pTasks.Count(t => t.EndDate.ToDateTime(TimeOnly.MinValue) < reportAsOf && ReportProgress(t) < 100m);
            int pAtRisk = pTasks.Count(t => IsTaskAtRisk(t, reportAsOf, ReportProgress(t)));
            int pOverBoq = overBoqByProject.GetValueOrDefault(proj.ProjectId);
            incidentsByProject.TryGetValue(proj.ProjectId, out var incidentMetrics);
            int pIncidentsCount = incidentMetrics?.Count ?? 0;
            decimal pLoss = incidentMetrics?.Loss ?? 0m;

            string health = "Green";
            if (pDelayed >= 3 || pLoss > 50000000m || pOverBoq >= 3) health = "Red";
            else if (pDelayed > 0 || pIncidentsCount > 0 || pOverBoq > 0) health = "Yellow";

            crossProjectMatrix.Add(new ProjectComparisonMatrixItemDto
            {
                ProjectId = proj.ProjectId,
                ProjectName = proj.Name,
                Status = proj.Status,
                ProgressPercent = pProg,
                TotalTasks = pTotal,
                DelayedTasks = pDelayed,
                AtRiskTasks = pAtRisk,
                OverBoqCount = pOverBoq,
                TotalIncidents = pIncidentsCount,
                EstimatedLossVnd = pLoss,
                HealthStatus = health
            });
        }

        // Calculate Monthly Trends for Executive Dashboard (Full Calendar Year T01 -> T12 & Multi-year History)
        var monthlyProgressTrends = new List<MonthlyProgressTrendDto>();
        DateTime startMonth;
        DateTime endMonth;

        if (fromDt.HasValue)
        {
            startMonth = fromDt.Value;
            endMonth = toDt ?? now;
        }
        else
        {
            var earliest = allTasks.Any() ? allTasks.Min(t => t.StartDate.ToDateTime(TimeOnly.MinValue)) : now;
            int startYear = Math.Min(earliest.Year, now.Year);
            startMonth = new DateTime(startYear, 1, 1);
            endMonth = toDt ?? new DateTime(now.Year, 12, 31);
        }

        var currentM = new DateTime(startMonth.Year, startMonth.Month, 1);
        var targetM = new DateTime(endMonth.Year, endMonth.Month, 1);

        // Pre-calculate task weights and duration info for S-Curve calculation
        var taskWeights = allTasks.Select(t =>
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

            double plannedWeightSum = 0;
            foreach (var item in taskWeights)
            {
                double taskWeight = item.DurationDays / totalProjectDurationDays;
                if (mEnd < item.Start) { }
                else if (mEnd >= item.End) { plannedWeightSum += taskWeight * 100.0; }
                else
                {
                    double elapsedDays = Math.Max(1, (mEnd - item.Start).TotalDays + 1);
                    double plannedFrac = Math.Min(1.0, elapsedDays / item.DurationDays);
                    plannedWeightSum += taskWeight * (plannedFrac * 100.0);
                }
            }
            decimal plannedCumulative = Math.Round((decimal)plannedWeightSum, 1);

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

            int doneInMonth = allTasks.Count(t => GetProgressAt(t, mEnd) >= 100m);

            monthlyProgressTrends.Add(new MonthlyProgressTrendDto
            {
                Year = currentM.Year,
                Month = currentM.Month,
                MonthLabel = $"T{currentM.Month:D2}/{currentM.Year}",
                CompletedTasksCount = doneInMonth,
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

        var dto = new ExecutiveDashboardDto
        {
            ProjectId = request.ProjectId,
            TotalTasks = totalTasks,
            CompletedTasks = completedTasks,
            InProgressTasks = inProgressTasks,
            DelayedTasks = delayedTasks,
            AtRiskTasks = atRiskTasks,
            OverBoqMaterialRequests = overBoqMRs,
            MaterialsExceedingBOQ = overBoqMaterialCount,
            PhaseBreakdown = phaseBreakdown,
            DelayedTasksList = allDelayedInfos,
            PeriodComparison = periodComparison,
            CrossProjectMatrix = crossProjectMatrix,
            MonthlyProgressTrends = monthlyProgressTrends
        };

        return ApiResponse<ExecutiveDashboardDto>.SuccessResult(dto);
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
            if (ProgressCalculator.IsCompleted(task.Status)
                && (!task.UpdatedAt.HasValue || task.UpdatedAt.Value <= asOf))
            {
                return 100m;
            }

            return 0m;
        }

        return 0m;
    }

    private static bool IsTaskAtRisk(ProjectTask task, DateTime asOf, decimal progress)
    {
        if (progress >= 100m) return false;

        var start = task.StartDate.ToDateTime(TimeOnly.MinValue);
        var end = task.EndDate.ToDateTime(TimeOnly.MinValue);
        if (start > asOf || end < asOf || (end - asOf).TotalDays > 3) return false;

        var duration = (end - start).TotalDays + 1;
        if (duration <= 0) return false;

        var elapsed = (asOf.Date - start).TotalDays + 1;
        var expectedProgress = Math.Min(100, elapsed / duration * 100);
        return progress < (decimal)expectedProgress - 20m;
    }
}

