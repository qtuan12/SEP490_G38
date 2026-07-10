using BPG.Application.IRepositories;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Reports.Queries.GetConstructionProgressReport;

public record GetConstructionProgressReportQuery(long ProjectId) : IRequest<ApiResponse<ConstructionProgressReportDto>>;

public class GetConstructionProgressReportQueryHandler
    : IRequestHandler<GetConstructionProgressReportQuery, ApiResponse<ConstructionProgressReportDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetConstructionProgressReportQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse<ConstructionProgressReportDto>> Handle(
        GetConstructionProgressReportQuery request, CancellationToken cancellationToken)
    {
        var phases = await _unitOfWork.Repository<Phase>()
            .Query()
            .Include(p => p.Tasks)
                .ThenInclude(t => t.Assignees)
                    .ThenInclude(a => a.User)
            .Include(p => p.Acceptances)
                .ThenInclude(a => a.Acceptor)
            .Where(p => p.ProjectId == request.ProjectId)
            .OrderBy(p => p.OrderIndex)
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;

        var allTasks = phases.SelectMany(p => p.Tasks).ToList();
        int total = allTasks.Count(t => t.Status != "Obsolete");
        int done = allTasks.Count(t => t.Status is "Done" or "Accepted" or "Approved");
        int inProg = allTasks.Count(t => t.Status == "InProgress");
        int assigned = allTasks.Count(t => t.Status == "Assigned");
        int newTasks = allTasks.Count(t => t.Status == "New");
        int obsolete = allTasks.Count(t => t.Status == "Obsolete");

        decimal overallProgress = total > 0
            ? Math.Round((decimal)done / total * 100, 1)
            : 0;

        var phaseProgressList = phases.Select(phase =>
        {
            var phaseTasks = phase.Tasks.Where(t => t.Status != "Obsolete").ToList();
            int ptTotal = phaseTasks.Count;
            int ptDone = phaseTasks.Count(t => t.Status is "Done" or "Accepted" or "Approved");
            decimal pProgress = ptTotal > 0 ? Math.Round((decimal)ptDone / ptTotal * 100, 1) : 0;

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
                        && t.ProgressPercent < 100
                        && t.Status is not ("Done" or "Accepted" or "Approved" or "Obsolete")
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
