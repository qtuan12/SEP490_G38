using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Reports.Queries.GetExecutiveDashboard;

public record GetExecutiveDashboardQuery(long ProjectId) : IRequest<ApiResponse<ExecutiveDashboardDto>>;

public class GetExecutiveDashboardQueryHandler : IRequestHandler<GetExecutiveDashboardQuery, ApiResponse<ExecutiveDashboardDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetExecutiveDashboardQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse<ExecutiveDashboardDto>> Handle(GetExecutiveDashboardQuery request, CancellationToken cancellationToken)
    {
        var phases = await _unitOfWork.Repository<Phase>()
            .Query()
            .Include(p => p.Tasks)
                .ThenInclude(t => t.Assignees)
                    .ThenInclude(a => a.User)
            .Where(p => p.ProjectId == request.ProjectId)
            .OrderBy(p => p.OrderIndex)
            .ToListAsync(cancellationToken);

        var allTasks = phases.SelectMany(p => p.Tasks)
            .Where(t => t.Status != "Obsolete")
            .ToList();

        int totalTasks = allTasks.Count;
        int completedTasks = allTasks.Count(t => t.Status is "Done" or "Accepted" or "Approved");
        int inProgressTasks = allTasks.Count(t => t.Status == "InProgress");

        var now = DateTime.UtcNow;
        var currentDate = now.Date;

        int delayedTasks = allTasks.Count(t =>
            t.EndDate.ToDateTime(TimeOnly.MinValue) < now &&
            t.ProgressPercent < 100 &&
            t.Status is not ("Done" or "Accepted" or "Approved" or "Obsolete"));

        int atRiskTasks = 0;
        var atRiskTaskInfos = new List<DelayedTaskInfoDto>();
        var delayedTaskInfos = new List<DelayedTaskInfoDto>();

        foreach (var t in allTasks.Where(t => t.ProgressPercent < 100 && t.StartDate.ToDateTime(TimeOnly.MinValue) <= now
            && t.Status is not ("Done" or "Accepted" or "Approved" or "Obsolete")))
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

        // Phase breakdown
        var phaseBreakdown = phases.Select(phase =>
        {
            var phaseTasks = phase.Tasks.Where(t => t.Status != "Obsolete").ToList();
            int ptTotal = phaseTasks.Count;
            int ptDone = phaseTasks.Count(t => t.Status is "Done" or "Accepted" or "Approved");
            decimal pProgress = ptTotal > 0 ? Math.Round((decimal)ptDone / ptTotal * 100, 1) : 0;

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
        var overBoqMRs = await _unitOfWork.Repository<MaterialRequest>()
            .Query()
            .Include(mr => mr.Phase)
            .Include(mr => mr.Items)
            .Where(mr => mr.Phase!.ProjectId == request.ProjectId && mr.Items.Any(i => i.IsOverBOQ))
            .CountAsync(cancellationToken);

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
