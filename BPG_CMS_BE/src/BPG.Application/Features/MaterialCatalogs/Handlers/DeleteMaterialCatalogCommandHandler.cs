using BPG.Application.Features.MaterialCatalogs.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

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

        // Kiểm tra xem vật tư có bất kỳ liên kết/giao dịch nào trong hệ thống không
        bool isUsed = await _uow.Repository<BOQItem>().Query().AnyAsync(x => x.MaterialId == request.MaterialId, cancellationToken)
            || await _uow.Repository<MaterialRequestItem>().Query().AnyAsync(x => x.MaterialId == request.MaterialId, cancellationToken)
            || await _uow.Repository<PurchaseOrderItem>().Query().AnyAsync(x => x.MaterialId == request.MaterialId, cancellationToken)
            || await _uow.Repository<GoodsReceiptItem>().Query().AnyAsync(x => x.MaterialId == request.MaterialId, cancellationToken)
            || await _uow.Repository<MaterialIssuanceItem>().Query().AnyAsync(x => x.MaterialId == request.MaterialId, cancellationToken)
            || await _uow.Repository<InventoryTransaction>().Query().AnyAsync(x => x.MaterialId == request.MaterialId, cancellationToken)
            || await _uow.Repository<DirectPurchaseItem>().Query().AnyAsync(x => x.MaterialId == request.MaterialId, cancellationToken)
            || await _uow.Repository<AdjustmentItem>().Query().AnyAsync(x => x.MaterialId == request.MaterialId, cancellationToken)
            || await _uow.Repository<SurplusRequestItem>().Query().AnyAsync(x => x.MaterialId == request.MaterialId, cancellationToken)
            || await _uow.Repository<MaterialReturnItem>().Query().AnyAsync(x => x.MaterialId == request.MaterialId, cancellationToken);

        if (isUsed)
        {
            throw new BusinessException("ERR_MATERIAL_ALREADY_USED", 
                "Không thể xóa vật tư này vì đã phát sinh dữ liệu liên quan trong hệ thống.");
        }

        entity.IsDeleted = true;
        repository.Update(entity);
        await _uow.SaveChangesAsync(cancellationToken);

        return true;
    }
}
