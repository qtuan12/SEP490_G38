using BPG.Application.Features.MaterialCatalogs.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;

namespace BPG.Application.Features.MaterialCatalogs.Handlers;

public class DeleteMaterialCatalogCommandHandler : IRequestHandler<DeleteMaterialCatalogCommand, bool>
{
    private readonly IUnitOfWork _uow;

    public DeleteMaterialCatalogCommandHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<bool> Handle(DeleteMaterialCatalogCommand request, CancellationToken cancellationToken)
    {
        var repository = _uow.Repository<MaterialCatalog>();

        var entity = await repository.GetByIdAsync(request.MaterialId, cancellationToken);
        if (entity == null)
        {
            throw new NotFoundException("MaterialCatalog", request.MaterialId);
        }

        entity.IsDeleted = true;
        
        repository.Update(entity);
        await _uow.SaveChangesAsync(cancellationToken);

        return true;
    }
}
