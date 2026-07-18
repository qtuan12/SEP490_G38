using AutoMapper;
using AutoMapper.QueryableExtensions;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialCatalogs;
using BPG.Application.Features.MaterialCatalogs.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.MaterialCatalogs.Handlers;

public class GetMaterialCatalogsQueryHandler : IRequestHandler<GetMaterialCatalogsQuery, PagedList<MaterialCatalogDto>>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public GetMaterialCatalogsQueryHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
    }

    public async Task<PagedList<MaterialCatalogDto>> Handle(GetMaterialCatalogsQuery request, CancellationToken cancellationToken)
    {
        var query = _uow.Repository<MaterialCatalog>().Query()
            .Include(x => x.Category)
            .Include(x => x.BaseUnit)
            .AsNoTracking();

        if (request.CategoryId.HasValue)
        {
            query = query.Where(x => x.CategoryId == request.CategoryId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var searchLower = request.Search.ToLower();
            query = query.Where(x => 
                x.Code.ToLower().Contains(searchLower) || 
                x.Name.ToLower().Contains(searchLower));
        }

        if (!string.IsNullOrWhiteSpace(request.SortBy))
        {
            var sortProperty = request.SortBy.ToLower();
            if (sortProperty == "code")
            {
                query = request.SortDescending ? query.OrderByDescending(x => x.Code) : query.OrderBy(x => x.Code);
            }
            else if (sortProperty == "name")
            {
                query = request.SortDescending ? query.OrderByDescending(x => x.Name) : query.OrderBy(x => x.Name);
            }
            else if (sortProperty == "materialid")
            {
                query = request.SortDescending ? query.OrderByDescending(x => x.MaterialId) : query.OrderBy(x => x.MaterialId);
            }
            else if (sortProperty == "categoryname")
            {
                query = request.SortDescending ? query.OrderByDescending(x => x.Category.CategoryName) : query.OrderBy(x => x.Category.CategoryName);
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

        var projectedQuery = query.ProjectTo<MaterialCatalogDto>(_mapper.ConfigurationProvider);
        return await projectedQuery.ToPagedListAsync(request.PageNumber, request.PageSize, cancellationToken);
    }
}
