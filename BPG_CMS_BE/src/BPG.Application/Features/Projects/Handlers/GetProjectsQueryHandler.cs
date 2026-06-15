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

    public GetProjectsQueryHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
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

        query = query.OrderByDescending(p => p.CreatedAt);

        return await query
            .ProjectTo<ProjectDto>(_mapper.ConfigurationProvider)
            .ToPagedListAsync(request.PageNumber, request.PageSize, cancellationToken);
    }
}
