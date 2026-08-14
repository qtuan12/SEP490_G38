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
        var terminalStatuses = resolvedStatuses.Append("Rejected").ToHashSet();

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

        // Calculate Monthly Incident Trends (Full Calendar Year T01 -> T12 & Multi-year History)
        var now = DateTime.UtcNow;
        DateTime startMonth;
        DateTime endMonth;

        if (request.FromDate.HasValue)
        {
            startMonth = request.FromDate.Value.Date;
            endMonth = request.ToDate?.Date ?? now;
        }
        else
        {
            var earliest = incidents.Any() ? incidents.Min(i => i.CreatedAt) : now;
            int startYear = Math.Min(earliest.Year, now.Year);
            startMonth = new DateTime(startYear, 1, 1);
            endMonth = request.ToDate?.Date ?? new DateTime(now.Year, 12, 31);
        }

        var currentM = new DateTime(startMonth.Year, startMonth.Month, 1);
        var targetM = new DateTime(endMonth.Year, endMonth.Month, 1);
        var monthlyIncidentTrends = new List<MonthlyIncidentTrendDto>();

        while (currentM <= targetM)
        {
            var mStart = currentM;
            var mEnd = currentM.AddMonths(1).AddTicks(-1);

            var monthIncidents = incidents.Where(i => i.CreatedAt >= mStart && i.CreatedAt <= mEnd).ToList();
            int totalInc = monthIncidents.Count;
            int resolvedInc = monthIncidents.Count(i => resolvedStatuses.Contains(i.Status));
            decimal lossVnd = monthIncidents.Sum(i => i.EstimatedMaterialLoss ?? 0m);

            monthlyIncidentTrends.Add(new MonthlyIncidentTrendDto
            {
                Year = currentM.Year,
                Month = currentM.Month,
                MonthLabel = $"T{currentM.Month:D2}/{currentM.Year}",
                TotalIncidentsCount = totalInc,
                ResolvedIncidentsCount = resolvedInc,
                EstimatedLossVnd = lossVnd
            });

            currentM = currentM.AddMonths(1);
        }

        var dto = new IncidentReportDto
        {
            ProjectId = request.ProjectId,
            TotalIncidents = incidents.Count,
            OpenIncidents = incidents.Count(i => !terminalStatuses.Contains(i.Status)),
            ResolvedIncidents = incidents.Count(i => resolvedStatuses.Contains(i.Status)),
            IncidentsWithRework = incidents.Count(i => i.ReworkTaskId.HasValue),
            Incidents = summaries,
            MonthlyTrends = monthlyIncidentTrends
        };

        return ApiResponse<IncidentReportDto>.SuccessResult(dto);
    }
}

