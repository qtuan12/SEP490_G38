namespace BPG.Application.Features.Projects.Handlers;


using BPG.Application.Features.Projects.DTOs;
using BPG.Application.Features.Projects.Queries;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

public class GetDashboardMetricsQueryHandler : IRequestHandler<GetDashboardMetricsQuery, DashboardMetricsDto>
{
    private readonly IUnitOfWork _uow;
    private readonly IPermissionService _permissionService;

    public GetDashboardMetricsQueryHandler(
        IUnitOfWork uow,
        IPermissionService permissionService)
    {
        _uow = uow;
        _permissionService = permissionService;
    }

    public async Task<DashboardMetricsDto> Handle(GetDashboardMetricsQuery request, CancellationToken cancellationToken)
    {
        var query = _uow.Repository<Project>().Query()
            .AsNoTracking();
        var accessibleProjectIds = await _permissionService.GetProjectIdsWithPermissionAsync(
            ProjectPermission.View,
            cancellationToken);
        query = query.Where(project => accessibleProjectIds.Contains(project.ProjectId));

        var projects = await query
            .Include(p => p.Phases)
                .ThenInclude(ph => ph.Tasks)
            .ToListAsync(cancellationToken);

        var metrics = new DashboardMetricsDto
        {
            TotalProjects = projects.Count,
            DraftProjects = projects.Count(p => p.Status == ProjectStatus.Draft),
            ActiveProjects = projects.Count(p => p.Status == ProjectStatus.InProgress),
            PausedProjects = projects.Count(p => p.Status == ProjectStatus.Paused),
            CompletedProjects = projects.Count(p => p.Status == ProjectStatus.Completed),
            ClosedProjects = projects.Count(p => p.Status == ProjectStatus.Closed),
            ActiveProjectsProgress = projects.Where(p => p.Status == ProjectStatus.InProgress || p.Status == ProjectStatus.Paused)
                .Select(p => 
                {
                    var allTasks = p.Phases?.SelectMany(ph => ph.Tasks).Where(t => t.Status != BPG.Domain.Constants.TaskStatus.Obsolete).ToList() ?? new List<BPG.Domain.Entities.ProjectTask>();
                    int progress = allTasks.Any() ? (int)allTasks.Average(t => t.ProgressPercent) : 0;
                    return new DashboardProjectProgressDto
                    {
                        ProjectId = p.ProjectId,
                        ProjectName = p.Name,
                        Address = p.Address ?? "",
                        Progress = progress,
                        Status = p.Status.ToString().ToLower()
                    };
                }).ToList()
        };

        return metrics;
    }
}
