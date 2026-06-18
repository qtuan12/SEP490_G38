using AutoMapper;
using AutoMapper.QueryableExtensions;
using BPG.Application.Features.MaterialConversions.DTOs;
using BPG.Application.Features.MaterialConversions.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialConversions.Handlers;

public class GetConversionsByMaterialIdQueryHandler : IRequestHandler<GetConversionsByMaterialIdQuery, List<MaterialConversionDto>>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public GetConversionsByMaterialIdQueryHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
    }

    public async Task<List<MaterialConversionDto>> Handle(GetConversionsByMaterialIdQuery request, CancellationToken cancellationToken)
    {
        // Gateway: Check if Material exists
        var materialExists = await _uow.Repository<MaterialCatalog>().AnyAsync(x => x.MaterialId == request.MaterialId && !x.IsDeleted, cancellationToken);
        if (!materialExists)
        {
            throw new NotFoundException("MaterialCatalog", request.MaterialId);
        }

        var query = _uow.Repository<MaterialConversion>().Query()
            .Where(x => x.MaterialId == request.MaterialId && !x.IsDeleted)
            .Include(x => x.AlternativeUnit) // Include to get AlternativeUnitName
            .OrderBy(x => x.AlternativeUnit.UnitName);

        var projectedQuery = query.ProjectTo<MaterialConversionDto>(_mapper.ConfigurationProvider);
        return await projectedQuery.ToListAsync(cancellationToken);
    }
}
