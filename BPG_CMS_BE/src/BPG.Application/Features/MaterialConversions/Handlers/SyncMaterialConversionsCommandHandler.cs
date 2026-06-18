using BPG.Application.Features.MaterialConversions.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialConversions.Handlers;

public class SyncMaterialConversionsCommandHandler : IRequestHandler<SyncMaterialConversionsCommand, bool>
{
    private readonly IUnitOfWork _uow;

    public SyncMaterialConversionsCommandHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<bool> Handle(SyncMaterialConversionsCommand request, CancellationToken cancellationToken)
    {
        // 1. Check if Material exists and get BaseUnitId
        var material = await _uow.Repository<MaterialCatalog>().FirstOrDefaultAsync(x => x.MaterialId == request.MaterialId && !x.IsDeleted, cancellationToken);
        if (material == null)
        {
            throw new NotFoundException("MaterialCatalog", request.MaterialId);
        }

        // 2. Validate AlternativeUnits
        var reqAltUnitIds = request.Conversions.Select(c => c.AlternativeUnitId).ToList();
        
        // 2a. Không được trùng với BaseUnit
        if (reqAltUnitIds.Contains(material.BaseUnitId))
        {
            throw new BusinessException("ERR_INVALID_ALTERNATIVE_UNIT", "Đơn vị quy đổi không được trùng với đơn vị gốc của vật tư.");
        }

        // 2b. Kiểm tra xem các AlternativeUnitId gửi lên có thực sự tồn tại trong bảng Unit không
        if (reqAltUnitIds.Any())
        {
            var validUnitsCount = await _uow.Repository<BPG.Domain.Entities.Unit>()
                .Query()
                .Where(u => reqAltUnitIds.Contains(u.UnitId) && !u.IsDeleted)
                .CountAsync(cancellationToken);

            if (validUnitsCount != reqAltUnitIds.Distinct().Count())
            {
                throw new BusinessException("ERR_UNIT_NOT_FOUND", "Một hoặc nhiều đơn vị quy đổi không tồn tại trong hệ thống.");
            }
        }

        // 3. Fetch existing conversions from DB (include soft-deleted ones so we can restore them if needed)
        // Note: IgnoreQueryFilters is needed to find previously deleted conversions to restore them instead of violating PK
        var existingConversions = await _uow.Repository<MaterialConversion>()
            .Query()
            .IgnoreQueryFilters()
            .Where(x => x.MaterialId == request.MaterialId)
            .ToListAsync(cancellationToken);

        // 4. Algorithm: Delete, Update, Add
        var existingUnitIds = existingConversions.Select(x => x.AlternativeUnitId).ToList();

        // 4a. Identify Deletions (In DB, but not in Request, and currently NOT deleted)
        var toDelete = existingConversions.Where(x => !reqAltUnitIds.Contains(x.AlternativeUnitId) && !x.IsDeleted).ToList();
        
        foreach (var conv in toDelete)
        {
            // GATEWAY CHECK: Luật Bất khả xâm phạm khi Xóa
            bool isInUse = 
                await _uow.Repository<BOQItem>().AnyAsync(x => x.MaterialId == request.MaterialId && x.UnitId == conv.AlternativeUnitId && !x.IsDeleted, cancellationToken) ||
                await _uow.Repository<PurchaseOrderItem>().AnyAsync(x => x.MaterialId == request.MaterialId && x.UnitId == conv.AlternativeUnitId, cancellationToken) ||
                await _uow.Repository<GoodsReceiptItem>().AnyAsync(x => x.MaterialId == request.MaterialId && x.UnitId == conv.AlternativeUnitId, cancellationToken) ||
                await _uow.Repository<MaterialIssuanceItem>().AnyAsync(x => x.MaterialId == request.MaterialId && x.UnitId == conv.AlternativeUnitId, cancellationToken) ||
                await _uow.Repository<CurrentInventory>().AnyAsync(x => x.MaterialId == request.MaterialId && x.UnitId == conv.AlternativeUnitId, cancellationToken);

            if (isInUse)
            {
                throw new BusinessException("ERR_CONVERSION_IN_USE", $"Không thể xóa tỷ lệ quy đổi của đơn vị có ID {conv.AlternativeUnitId} vì nó đã được sử dụng trong các giao dịch lịch sử.");
            }

            conv.IsDeleted = true; // Soft Delete
            _uow.Repository<MaterialConversion>().Update(conv);
        }

        // 4b. Identify Updates (In both DB and Request)
        var toUpdate = existingConversions.Where(x => reqAltUnitIds.Contains(x.AlternativeUnitId)).ToList();
        foreach (var conv in toUpdate)
        {
            var req = request.Conversions.First(c => c.AlternativeUnitId == conv.AlternativeUnitId);
            conv.ConversionRate = req.ConversionRate;
            conv.IsDeleted = false; // Restore if it was soft-deleted
            _uow.Repository<MaterialConversion>().Update(conv);
        }

        // 4c. Identify Additions (In Request, but completely not in DB)
        var toAdd = request.Conversions.Where(r => !existingUnitIds.Contains(r.AlternativeUnitId)).ToList();
        foreach (var req in toAdd)
        {
            var newConv = new MaterialConversion
            {
                MaterialId = request.MaterialId,
                AlternativeUnitId = req.AlternativeUnitId,
                ConversionRate = req.ConversionRate
            };
            await _uow.Repository<MaterialConversion>().AddAsync(newConv, cancellationToken);
        }

        await _uow.SaveChangesAsync(cancellationToken);
        return true;
    }
}
