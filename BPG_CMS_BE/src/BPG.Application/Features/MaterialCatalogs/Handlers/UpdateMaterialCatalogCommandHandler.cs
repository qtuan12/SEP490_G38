using AutoMapper;
using BPG.Application.Features.MaterialCatalogs.Commands;
using BPG.Application.DTOs.MaterialCatalogs;
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

        if (entity.BaseUnitId != request.BaseUnitId)
        {
            // Kiểm tra xem vật tư đã phát sinh giao dịch/yêu cầu nào chưa
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
                throw new BusinessException("ERR_CANNOT_CHANGE_BASE_UNIT", 
                    "Không thể thay đổi Đơn vị tính cơ bản của vật tư đã phát sinh giao dịch.");
            }
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
