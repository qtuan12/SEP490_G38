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

            // Phase expected progress calculation using task dates
            decimal expProgress = BPG.Application.Common.Helpers.ProgressCalculator.CalculateWeightedExpectedProgress(phaseTasks, now);
            int phaseVarianceDays = 0;
            var overdueTasks = phaseTasks.Where(t => t.EndDate.ToDateTime(TimeOnly.MinValue) < now && !BPG.Application.Common.Helpers.ProgressCalculator.IsCompleted(t.Status)).ToList();
            if (overdueTasks.Any())
            {
                phaseVarianceDays = overdueTasks.Max(t => (now - t.EndDate.ToDateTime(TimeOnly.MinValue)).Days);
            }

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
                ExpectedProgressPercent = expProgress,
                ScheduleVarianceDays = phaseVarianceDays,
                StartDate = phase.StartDate,
                EndDate = phase.EndDate,
                DelayedTasks = delayedTasks,
                AllTasks = allTasksSummary
            };
        }).ToList();

        // Calculate overall expected progress
        decimal overallExpectedProgress = BPG.Application.Common.Helpers.ProgressCalculator.CalculateWeightedExpectedProgress(validTasks, now);

        int totalDelayedDays = 0;
        var allOverdueTasks = validTasks.Where(t => t.EndDate.ToDateTime(TimeOnly.MinValue) < now && !BPG.Application.Common.Helpers.ProgressCalculator.IsCompleted(t.Status)).ToList();
        if (allOverdueTasks.Any())
        {
            totalDelayedDays = allOverdueTasks.Max(t => (now - t.EndDate.ToDateTime(TimeOnly.MinValue)).Days);
        }

        // Forecasted completion date
        string? forecastedEndDateStr = null;
        if (validTasks.Any() && overallProgress > 0)
        {
            var minTaskStart = validTasks.Min(t => t.StartDate.ToDateTime(TimeOnly.MinValue));
            var maxTaskEnd = validTasks.Max(t => t.EndDate.ToDateTime(TimeOnly.MaxValue));
            var elapsedDays = (now - minTaskStart).TotalDays;
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
                int doneT = g.Count(x => BPG.Application.Common.Helpers.ProgressCalculator.IsCompleted(x.Task.Status));
                int delayedT = g.Count(x => x.Task.EndDate.ToDateTime(TimeOnly.MinValue) < now && !BPG.Application.Common.Helpers.ProgressCalculator.IsCompleted(x.Task.Status));
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
        else
        {
            insights.Add($"Cảnh báo: Tiến độ thực tế ({overallProgress}%) đang chậm {Math.Abs(variancePercent):F1}% so với tiến độ kế hoạch kỳ vọng ({overallExpectedProgress}%).");
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
            ForecastedEndDate = forecastedEndDateStr,
            Phases = phaseProgressList,
            Acceptances = acceptances,
            AssigneePerformance = assigneePerformanceList,
            ProgressInsights = insights
        };

        return ApiResponse<ConstructionProgressReportDto>.SuccessResult(dto);
    }
}

