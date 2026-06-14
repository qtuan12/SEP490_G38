namespace BPG.Application.Features.Projects.Handlers;


using BPG.Application.Features.Projects.DTOs;
using BPG.Application.Features.Projects.Queries;
using BPG.Application.IRepositories;
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

    public GetDashboardMetricsQueryHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<DashboardMetricsDto> Handle(GetDashboardMetricsQuery request, CancellationToken cancellationToken)
    {
        var projects = await _uow.Repository<Project>().Query()
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var metrics = new DashboardMetricsDto
        {
            TotalProjects = projects.Count,
            DraftProjects = projects.Count(p => p.Status == ProjectStatus.Draft),
            ActiveProjects = projects.Count(p => p.Status == ProjectStatus.Active),
            PausedProjects = projects.Count(p => p.Status == ProjectStatus.Paused),
            CompletedProjects = projects.Count(p => p.Status == ProjectStatus.Completed),
            ClosedProjects = projects.Count(p => p.Status == ProjectStatus.Closed)
        };

        return metrics;
    }
}
