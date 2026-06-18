using AutoMapper;
using BPG.Application.Features.MaterialCatalogs.Commands;
using BPG.Application.Features.MaterialCatalogs.DTOs;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.MaterialCatalogs.Handlers;

public class UpdateMaterialCatalogCommandHandler : IRequestHandler<UpdateMaterialCatalogCommand, MaterialCatalogDto>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public UpdateMaterialCatalogCommandHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
    }

    public async Task<MaterialCatalogDto> Handle(UpdateMaterialCatalogCommand request, CancellationToken cancellationToken)
    {
        var repository = _uow.Repository<MaterialCatalog>();

        var entity = await repository.Query()
            .Include(x => x.Category)
            .Include(x => x.BaseUnit)
            .FirstOrDefaultAsync(x => x.MaterialId == request.MaterialId, cancellationToken);

        if (entity == null)
        {
            throw new NotFoundException("MaterialCatalog", request.MaterialId);
        }

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
        var codeExists = await repository.AnyAsync(
            x => x.MaterialId != request.MaterialId && x.Code.Trim().ToLower() == trimmedCode.ToLower() && !x.IsDeleted,
            cancellationToken
        );

        if (codeExists)
        {
            throw new DuplicateEntryException("Code", request.Code);
        }

        entity.CategoryId = request.CategoryId;
        entity.BaseUnitId = request.BaseUnitId;
        entity.Code = trimmedCode;
        entity.Name = request.Name.Trim();
        entity.Specification = request.Specification?.Trim();

        repository.Update(entity);
        await _uow.SaveChangesAsync(cancellationToken);

        return _mapper.Map<MaterialCatalogDto>(entity);
    }
}
