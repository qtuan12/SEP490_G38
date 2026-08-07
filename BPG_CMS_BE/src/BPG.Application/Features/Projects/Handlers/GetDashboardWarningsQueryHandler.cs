using BPG.Application.IServices;
using BPG.Application.IRepositories;
using BPG.Application.Features.Projects.DTOs;
using BPG.Application.Features.Projects.Queries;
using BPG.Domain.Common;
using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using BPG.Domain.Entities;
using BPG.Domain.Constants;

namespace BPG.Application.Features.Projects.Handlers;

public class GetDashboardWarningsQueryHandler : IRequestHandler<GetDashboardWarningsQuery, List<DashboardWarningDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProjectAccessService _projectAccessService;

    public GetDashboardWarningsQueryHandler(
        IUnitOfWork unitOfWork,
        IProjectAccessService projectAccessService)
    {
        _unitOfWork = unitOfWork;
        _projectAccessService = projectAccessService;
    }

    public async Task<List<DashboardWarningDto>> Handle(GetDashboardWarningsQuery request, CancellationToken cancellationToken)
    {
        var warnings = new List<DashboardWarningDto>();
        var now = VietnamTime.Now;

        // Retrieve active projects with their phases, tasks
        var query = _unitOfWork.Repository<Project>().Query()
            .Where(p => p.Status == ProjectStatus.InProgress);
        var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
        query = query.Where(project => accessibleProjectIds.Contains(project.ProjectId));

        var activeProjects = await query
            .Include(p => p.Phases)
                .ThenInclude(ph => ph.Tasks)
            .ToListAsync(cancellationToken);
            
        var activeProjectIds = activeProjects.Select(p => p.ProjectId).ToList();
        var allIncidents = await _unitOfWork.Repository<Incident>().Query()
            .Where(i => activeProjectIds.Contains(i.ProjectId) && (i.Status == IncidentStatus.Resolved || i.Status == IncidentStatus.Closed))
            .ToListAsync(cancellationToken);

        var dateOnlyNow = DateOnly.FromDateTime(now);

        foreach (var project in activeProjects)
        {
            var reworkTaskIds = new HashSet<long>();
            
            var projectIncidents = allIncidents.Where(i => i.ProjectId == project.ProjectId).ToList();
            
            // 1. Critical Warning: Rework Breach
            foreach (var incident in projectIncidents)
            {
                var reworkTask = project.Phases.SelectMany(ph => ph.Tasks)
                    .FirstOrDefault(t => t.TaskId == incident.ReworkTaskId || 
                                        (t.Name != null && incident.Task != null && t.Name.Contains(incident.Task.Name) && t.Name.StartsWith("[Rework]")));
                
                if (reworkTask != null)
                {
                    reworkTaskIds.Add(reworkTask.TaskId);
                    var phase = project.Phases.FirstOrDefault(ph => ph.PhaseId == reworkTask.PhaseId);
                    if (phase != null && phase.EndDate.HasValue)
                    {
                        if (reworkTask.EndDate > phase.EndDate.Value)
                        {
                            warnings.Add(new DashboardWarningDto
                            {
                                ProjectId = project.ProjectId,
                                ProjectName = project.Name,
                                TaskId = reworkTask.TaskId,
                                TaskName = reworkTask.Name,
                                WarningType = "Critical",
                                Message = $"Công việc khắc phục \"{reworkTask.Name}\" có hạn hoàn thành ({reworkTask.EndDate:yyyy-MM-dd}) vượt quá Hạn chót của Giai đoạn \"{phase.Name}\" ({phase.EndDate.Value:yyyy-MM-dd})."
                            });
                        }
                    }
                }
            }

            // 2. Red / Yellow Warnings
            var ongoingTasks = project.Phases.SelectMany(ph => ph.Tasks)
                .Where(t => t.Status != BPG.Domain.Constants.TaskStatus.Obsolete && t.Status != BPG.Domain.Constants.TaskStatus.Approved && t.ProgressPercent < 100);

            foreach (var task in ongoingTasks)
            {
                if (dateOnlyNow > task.EndDate)
                {
                    // RED warning
                    warnings.Add(new DashboardWarningDto
                    {
                        ProjectId = project.ProjectId,
                        ProjectName = project.Name,
                        TaskId = task.TaskId,
                        TaskName = task.Name,
                        WarningType = "Red",
                        Message = $"Quá hạn {Math.Floor((now - task.EndDate.ToDateTime(TimeOnly.MinValue)).TotalDays)} ngày nhưng chưa hoàn thành (Tiến độ: {task.ProgressPercent}%)."
                    });
                }
                else if (dateOnlyNow >= task.StartDate)
                {
                    // YELLOW warning
                    double totalDays = (task.EndDate.ToDateTime(TimeOnly.MinValue) - task.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays;
                    if (totalDays > 0)
                    {
                        double elapsedDays = (now - task.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays;
                        double expectedProgress = (elapsedDays / totalDays) * 100.0;
                        if (task.ProgressPercent < expectedProgress - 15) // Tolerance of 15%
                        {
                            warnings.Add(new DashboardWarningDto
                            {
                                ProjectId = project.ProjectId,
                                ProjectName = project.Name,
                                TaskId = task.TaskId,
                                TaskName = task.Name,
                                WarningType = "Yellow",
                                Message = $"Nguy cơ trễ hạn. Tiến độ thực tế ({task.ProgressPercent}%) thấp hơn kỳ vọng (~{expectedProgress:F1}%)."
                            });
                        }
                    }
                }
            }
        }

        return warnings.OrderByDescending(w => w.WarningType == "Critical" ? 3 : w.WarningType == "Red" ? 2 : 1).ToList();
    }
}
