using AutoMapper;
using BPG.Application.Features.MaterialCatalogs.Commands;
using BPG.Application.Features.MaterialCatalogs.DTOs;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.MaterialCatalogs.Handlers;

public class CreateMaterialCatalogCommandHandler : IRequestHandler<CreateMaterialCatalogCommand, MaterialCatalogDto>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public CreateMaterialCatalogCommandHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
    }

    public async Task<MaterialCatalogDto> Handle(CreateMaterialCatalogCommand request, CancellationToken cancellationToken)
    {
        var categoryExists = await _uow.Repository<MaterialCategory>().AnyAsync(x => x.CategoryId == request.CategoryId && !x.IsDeleted, cancellationToken);
        if (!categoryExists)
        {
            throw new NotFoundException(nameof(MaterialCategory), request.CategoryId);
        }

        var unitExists = await _uow.Repository<BPG.Domain.Entities.Unit>().AnyAsync(x => x.UnitId == request.BaseUnitId && !x.IsDeleted, cancellationToken);
        if (!unitExists)
        {
            throw new NotFoundException("Unit", request.BaseUnitId);
        }

        var trimmedCode = request.Code.Trim();
        var codeExists = await _uow.Repository<MaterialCatalog>().AnyAsync(
            x => x.Code.Trim().ToLower() == trimmedCode.ToLower() && !x.IsDeleted,
            cancellationToken
        );

        if (codeExists)
        {
            throw new DuplicateEntryException("Code", request.Code);
        }

        var entity = new MaterialCatalog
        {
            CategoryId = request.CategoryId,
            BaseUnitId = request.BaseUnitId,
            Code = trimmedCode,
            Name = request.Name.Trim(),
            Specification = request.Specification?.Trim()
        };

        await _uow.Repository<MaterialCatalog>().AddAsync(entity);
        await _uow.SaveChangesAsync(cancellationToken);

        var fullEntity = await _uow.Repository<MaterialCatalog>().Query()
            .Include(x => x.Category)
            .Include(x => x.BaseUnit)
            .FirstOrDefaultAsync(x => x.MaterialId == entity.MaterialId, cancellationToken);

        return _mapper.Map<MaterialCatalogDto>(fullEntity ?? entity);
    }
}
