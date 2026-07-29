using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Incidents;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using AutoMapper;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Incidents.Queries.GetAllIncidents;

public record GetAllIncidentsQuery() : IRequest<ApiResponse<List<IncidentDto>>>;

public class GetAllIncidentsQueryHandler : IRequestHandler<GetAllIncidentsQuery, ApiResponse<List<IncidentDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly IProjectAccessService _projectAccessService;

    public GetAllIncidentsQueryHandler(
        IUnitOfWork unitOfWork,
        IMapper mapper,
        IProjectAccessService projectAccessService)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _projectAccessService = projectAccessService;
    }

    public async Task<ApiResponse<List<IncidentDto>>> Handle(GetAllIncidentsQuery request, CancellationToken cancellationToken)
    {
        var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
        var incidents = await _unitOfWork.Repository<Incident>()
            .Query()
            .Where(incident => accessibleProjectIds.Contains(incident.ProjectId))
            .Include(i => i.Reporter)
            .Include(i => i.Reviewer)
            .Include(i => i.Project)
            .Include(i => i.Task)
            .Include(i => i.Phase)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(cancellationToken);

        var dtos = _mapper.Map<List<IncidentDto>>(incidents);

        return ApiResponse<List<IncidentDto>>.SuccessResult(dtos);
    }
}
