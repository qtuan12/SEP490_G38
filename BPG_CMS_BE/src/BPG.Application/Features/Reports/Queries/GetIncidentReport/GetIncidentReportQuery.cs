using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Reports.Queries.GetIncidentReport;

public record GetIncidentReportQuery(long ProjectId, DateTime? FromDate = null, DateTime? ToDate = null)
    : IRequest<ApiResponse<IncidentReportDto>>;

public class GetIncidentReportQueryHandler
    : IRequestHandler<GetIncidentReportQuery, ApiResponse<IncidentReportDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProjectAccessService _projectAccessService;

    public GetIncidentReportQueryHandler(
        IUnitOfWork unitOfWork,
        IProjectAccessService projectAccessService)
    {
        _unitOfWork = unitOfWork;
        _projectAccessService = projectAccessService;
    }

    public async Task<ApiResponse<IncidentReportDto>> Handle(
        GetIncidentReportQuery request, CancellationToken cancellationToken)
    {
        var accessibleIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
        if (request.ProjectId > 0 && !accessibleIds.Contains(request.ProjectId))
        {
            throw new BPG.Domain.Exceptions.BusinessException("ERR_FORBIDDEN", "Bạn không có quyền xem báo cáo của dự án này.");
        }

        var query = _unitOfWork.Repository<Incident>()
            .Query()
            .Include(i => i.Reporter)
            .Include(i => i.Reviewer)
            .Include(i => i.Task)
            .Include(i => i.Phase)
            .Include(i => i.ReworkTask)
            .AsNoTracking();

        if (request.ProjectId > 0)
        {
            query = query.Where(i => i.ProjectId == request.ProjectId);
        }
        else
        {
            query = query.Where(i => accessibleIds.Contains(i.ProjectId));
        }

        if (request.FromDate.HasValue)
        {
            var fromDt = request.FromDate.Value.Date;
            query = query.Where(i => i.CreatedAt >= fromDt);
        }
        if (request.ToDate.HasValue)
        {
            var toDt = request.ToDate.Value.Date.AddDays(1).AddTicks(-1);
            query = query.Where(i => i.CreatedAt <= toDt);
        }

        var incidents = await query
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(cancellationToken);

        var resolvedStatuses = new[] { "Approved", "Resolved", "Closed", "Completed" };

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

