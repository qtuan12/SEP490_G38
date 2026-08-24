
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Incidents;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using AutoMapper;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Incidents.Queries.GetIncidents;

public record GetIncidentsQuery(long ProjectId)
    : IRequest<ApiResponse<List<IncidentDto>>>;

public class GetIncidentsQueryHandler : IRequestHandler<GetIncidentsQuery, ApiResponse<List<IncidentDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly IProjectAccessService _projectAccessService;

    public GetIncidentsQueryHandler(
        IUnitOfWork unitOfWork,
        IMapper mapper,
        IProjectAccessService projectAccessService)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _projectAccessService = projectAccessService;
    }

    public async Task<ApiResponse<List<IncidentDto>>> Handle(GetIncidentsQuery request, CancellationToken cancellationToken)
    {
        var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
        if (!accessibleProjectIds.Contains(request.ProjectId))
        {
            throw new ForbiddenException("Bạn không có quyền xem sự cố của dự án này.");
        }

        var incidents = await _unitOfWork.Repository<Incident>()
            .Query()
            .Include(i => i.Reporter)
            .Include(i => i.Reviewer)
            .Include(i => i.Project)
            .Include(i => i.Task)
            .Include(i => i.Phase)
            .Where(i => i.ProjectId == request.ProjectId)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(cancellationToken);

        var dtos = _mapper.Map<List<IncidentDto>>(incidents);

        var incidentIds = incidents.Select(incident => incident.IncidentId).ToList();
        var latestAdjustments = await _unitOfWork.Repository<InventoryAdjustment>()
            .Query()
            .Where(adjustment => adjustment.IncidentId.HasValue
                && incidentIds.Contains(adjustment.IncidentId.Value)
                && adjustment.AdjustmentType == InventoryAdjustmentType.Decrease)
            .OrderByDescending(adjustment => adjustment.CreatedAt)
            .ThenByDescending(adjustment => adjustment.AdjustmentId)
            .Select(adjustment => new
            {
                adjustment.IncidentId,
                adjustment.AdjustmentId,
                adjustment.Status
            })
            .ToListAsync(cancellationToken);

        var latestByIncident = latestAdjustments
            .GroupBy(adjustment => adjustment.IncidentId!.Value)
            .ToDictionary(group => group.Key, group => group.First());

        dtos = dtos.Select(dto => latestByIncident.TryGetValue(dto.IncidentId, out var adjustment)
            ? dto with
            {
                LatestAdjustmentId = adjustment.AdjustmentId,
                LatestAdjustmentStatus = adjustment.Status
            }
            : dto).ToList();

        return ApiResponse<List<IncidentDto>>.SuccessResult(dtos);
    }
}

