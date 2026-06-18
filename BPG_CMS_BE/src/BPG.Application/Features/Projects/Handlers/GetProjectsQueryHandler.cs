namespace BPG.Application.Features.Projects.Handlers;

using AutoMapper;
using AutoMapper.QueryableExtensions;
using BPG.Application.Common.Models;
using BPG.Application.Features.Projects.DTOs;
using BPG.Application.Features.Projects.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

public class GetProjectsQueryHandler : IRequestHandler<GetProjectsQuery, PagedList<ProjectDto>>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;
    private readonly BPG.Application.IServices.ICurrentUserService _currentUserService;

    public GetProjectsQueryHandler(IUnitOfWork uow, IMapper mapper, BPG.Application.IServices.ICurrentUserService currentUserService)
    {
        _uow = uow;
        _mapper = mapper;
        _currentUserService = currentUserService;
    }

    public async Task<PagedList<ProjectDto>> Handle(GetProjectsQuery request, CancellationToken cancellationToken)
    {
        var query = _uow.Repository<Project>().Query()
            .AsNoTracking();

        if (!string.IsNullOrEmpty(request.Status))
        {
            query = query.Where(p => p.Status == request.Status);
        }

        if (!string.IsNullOrEmpty(request.Search))
        {
            var search = request.Search.ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(search) || 
                                     (p.Address != null && p.Address.ToLower().Contains(search)));
        }

        // Restrict projects for Site Engineers to only those they are assigned to
        if (_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.SiteEngineer))
        {
            var currentUserId = _currentUserService.GetRequiredUserId();
            query = query.Where(p => p.Members.Any(m => m.UserId == currentUserId));
        }

        query = query.OrderByDescending(p => p.CreatedAt);

        var pagedList = await query
            .ProjectTo<ProjectDto>(_mapper.ConfigurationProvider)
            .ToPagedListAsync(request.PageNumber, request.PageSize, cancellationToken);

        if (pagedList.Items.Any())
        {
            var projectIds = pagedList.Items.Select(p => p.ProjectId).ToList();
            var tasks = await _uow.Repository<ProjectTask>().Query()
                .AsNoTracking()
                .Where(t => projectIds.Contains(t.Phase.ProjectId) && t.Status != BPG.Domain.Constants.TaskStatus.Obsolete)
                .Select(t => new { t.TaskId, t.ParentTaskId, t.Phase.ProjectId, t.StartDate, t.EndDate, t.ProgressPercent })
                .ToListAsync(cancellationToken);

            foreach (var p in pagedList.Items)
            {
                var pTasks = tasks.Where(t => t.ProjectId == p.ProjectId).ToList();
                var leafTasks = pTasks.Where(t => !pTasks.Any(c => c.ParentTaskId == t.TaskId)).ToList();
                if (leafTasks.Any())
                {
                    double totalWeightedProgress = 0;
                    double totalWeight = 0;
                    foreach (var t in leafTasks)
                    {
                        var duration = (t.EndDate.ToDateTime(TimeOnly.MinValue) - t.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;
                        double weight = duration > 0 ? duration : 1;
                        totalWeightedProgress += t.ProgressPercent * weight;
                        totalWeight += weight;
                    }
                    if (totalWeight > 0)
                    {
                        p.Progress = (int)Math.Round(totalWeightedProgress / totalWeight);
                    }
                }
            }
        }

        return pagedList;
    }
}
