using AutoMapper;
using AutoMapper.QueryableExtensions;
using BPG.Application.Common.Models;
using BPG.Application.Features.Units.DTOs;
using BPG.Application.Features.Units.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Units.Handlers;

public class GetUnitsQueryHandler : IRequestHandler<GetUnitsQuery, PagedList<UnitDto>>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public GetUnitsQueryHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
    }

    public async Task<PagedList<UnitDto>> Handle(GetUnitsQuery request, CancellationToken cancellationToken)
    {
        var query = _uow.Repository<BPG.Domain.Entities.Unit>().Query().AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var searchLower = request.Search.ToLower();
            query = query.Where(x => 
                x.UnitCode.ToLower().Contains(searchLower) || 
                x.UnitName.ToLower().Contains(searchLower));
        }

        if (!string.IsNullOrWhiteSpace(request.SortBy))
        {
            var sortProperty = request.SortBy.ToLower();
            if (sortProperty == "unitcode")
            {
                query = request.SortDescending ? query.OrderByDescending(x => x.UnitCode) : query.OrderBy(x => x.UnitCode);
            }
            else if (sortProperty == "unitname")
            {
                query = request.SortDescending ? query.OrderByDescending(x => x.UnitName) : query.OrderBy(x => x.UnitName);
            }
            else if (sortProperty == "unitid")
            {
                query = request.SortDescending ? query.OrderByDescending(x => x.UnitId) : query.OrderBy(x => x.UnitId);
            }
            else if (sortProperty == "createdat")
            {
                query = request.SortDescending ? query.OrderByDescending(x => x.CreatedAt) : query.OrderBy(x => x.CreatedAt);
            }
            else
            {
                query = query.OrderByDescending(x => x.CreatedAt);
            }
        }
        else
        {
            query = query.OrderByDescending(x => x.CreatedAt);
        }

        var projectedQuery = query.ProjectTo<UnitDto>(_mapper.ConfigurationProvider);
        return await projectedQuery.ToPagedListAsync(request.PageNumber, request.PageSize, cancellationToken);
    }
}
