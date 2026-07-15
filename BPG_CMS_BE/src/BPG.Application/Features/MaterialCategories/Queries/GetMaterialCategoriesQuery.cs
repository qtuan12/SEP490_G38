using AutoMapper;
using AutoMapper.QueryableExtensions;
using BPG.Application.IRepositories;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialCategories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.MaterialCategories.Queries;

public class GetMaterialCategoriesQuery : PaginationRequest, IRequest<PagedList<MaterialCategoryDto>>
{
}

public class GetMaterialCategoriesQueryHandler : IRequestHandler<GetMaterialCategoriesQuery, PagedList<MaterialCategoryDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public GetMaterialCategoriesQueryHandler(IUnitOfWork unitOfWork, IMapper mapper)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<PagedList<MaterialCategoryDto>> Handle(GetMaterialCategoriesQuery request, CancellationToken cancellationToken)
    {
        IQueryable<MaterialCategory> query = _unitOfWork.Repository<MaterialCategory>().Query().AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            query = query.Where(x => x.CategoryName.Contains(request.Search));
        }

        // Apply sorting
        if (!string.IsNullOrWhiteSpace(request.SortBy))
        {
            var sortProperty = request.SortBy.ToLower();
            if (sortProperty == "categoryname" || sortProperty == "name")
            {
                query = request.SortDescending
                    ? query.OrderByDescending(x => x.CategoryName)
                    : query.OrderBy(x => x.CategoryName);
            }
            else if (sortProperty == "categoryid" || sortProperty == "id")
            {
                query = request.SortDescending
                    ? query.OrderByDescending(x => x.CategoryId)
                    : query.OrderBy(x => x.CategoryId);
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

        var projectedQuery = query.ProjectTo<MaterialCategoryDto>(_mapper.ConfigurationProvider);
        return await projectedQuery.ToPagedListAsync(request, cancellationToken);
    }
}
