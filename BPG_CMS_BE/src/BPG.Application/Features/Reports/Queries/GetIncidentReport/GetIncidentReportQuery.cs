using BPG.Application.Common.Authorization;
using BPG.Application.IRepositories;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Reports.Queries.GetIncidentReport;

public record GetIncidentReportQuery(long ProjectId)
    : IRequest<ApiResponse<IncidentReportDto>>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.Project(ProjectId);
    public string RequiredPermission => ProjectPermission.ReportsView;
}


public class GetIncidentReportQueryHandler
    : IRequestHandler<GetIncidentReportQuery, ApiResponse<IncidentReportDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetIncidentReportQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse<IncidentReportDto>> Handle(
        GetIncidentReportQuery request, CancellationToken cancellationToken)
    {
        var incidents = await _unitOfWork.Repository<Incident>()
            .Query()
            .Include(i => i.Reporter)
            .Include(i => i.Reviewer)
            .Include(i => i.Task)
            .Include(i => i.Phase)
            .Include(i => i.ReworkTask)
            .Where(i => i.ProjectId == request.ProjectId)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(cancellationToken);

        var resolvedStatuses = new[] { "Resolved", "Closed", "Completed" };

        var summaries = incidents.Select(i => new IncidentSummaryDto
        {
            IncidentId = i.IncidentId,
            IncidentType = i.IncidentType,
            Description = i.Description,
            Status = i.Status,
            ReporterName = i.Reporter?.FullName ?? string.Empty,
            ReviewerName = i.Reviewer?.FullName,
            TaskName = i.Task?.Name,
            PhaseName = i.Phase?.Name,
            DamageDescription = i.DamageDescription,
            EstimatedMaterialLoss = i.EstimatedMaterialLoss,
            EstimatedDelayDays = i.EstimatedDelayDays,
            HasReworkTask = i.ReworkTaskId.HasValue,
            ReworkTaskName = i.ReworkTask?.Name,
            CreatedAt = i.CreatedAt
        }).ToList();

        var dto = new IncidentReportDto
        {
            ProjectId = request.ProjectId,
            TotalIncidents = incidents.Count,
            OpenIncidents = incidents.Count(i => !resolvedStatuses.Contains(i.Status)),
            ResolvedIncidents = incidents.Count(i => resolvedStatuses.Contains(i.Status)),
            IncidentsWithRework = incidents.Count(i => i.ReworkTaskId.HasValue),
            Incidents = summaries
        };

        return ApiResponse<IncidentReportDto>.SuccessResult(dto);
    }
}
