using BPG.Application.Common.Helpers;
using BPG.Application.DTOs.DirectPurchases;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.DirectPurchases.Services
{
    public class DirectPurchaseFulfillmentService : IDirectPurchaseFulfillmentService
    {
        private readonly IUnitOfWork _uow;
        private readonly IInventoryService _inventoryService;

        public DirectPurchaseFulfillmentService(IUnitOfWork uow, IInventoryService inventoryService)
        {
            _uow = uow;
            _inventoryService = inventoryService;
        }

        public async Task<List<ResolvedDirectPurchaseItem>> ResolveItemsAsync(
            long phaseId,
            IReadOnlyList<DirectPurchaseItemInput> items,
            CancellationToken ct)
        {
            var result = new List<ResolvedDirectPurchaseItem>();

            foreach (var item in items)
            {
                var material = await _uow.Repository<MaterialCatalog>().Query()
                    .Include(m => m.BaseUnit)
                    .FirstOrDefaultAsync(m => m.MaterialId == item.MaterialId && !m.IsDeleted, ct)
                    ?? throw new NotFoundException(nameof(MaterialCatalog), item.MaterialId);

                var boq = await _uow.Repository<BOQItem>().Query()
                    .Include(b => b.Unit)
                    .FirstOrDefaultAsync(b => b.PhaseId == phaseId && b.MaterialId == item.MaterialId && !b.IsDeleted, ct);

                // Chỉ được mua khẩn cấp những vật tư đã có trong định mức BOQ của giai đoạn.
                // Chặn ngay từ khâu soạn nháp để người dùng không nhập cả phiếu rồi mới bị từ chối.
                if (boq == null)
                    throw new BusinessException(ErrorCodes.DpMaterialNotInBoq,
                        $"Vật tư '{material.Name}' chưa có trong định mức BOQ của giai đoạn nên không thể mua khẩn cấp. " +
                        "Vui lòng bổ sung vật tư vào bảng định mức trước.");

                int unitId;
                decimal conversionRate;
                Domain.Entities.Unit unit;

                if (item.UnitId > 0)
                {
                    // Người dùng chủ động chọn đơn vị: chỉ chấp nhận đơn vị cơ bản hoặc một đơn vị
                    // đã khai báo quy đổi. Tỷ lệ tra lại từ DB, không nhận từ client — client gửi
                    // tỷ lệ sai là lệch toàn bộ phép đối chiếu định mức (mọi so sánh quy về ĐV cơ bản).
                    unitId = item.UnitId;

                    if (unitId == material.BaseUnitId)
                    {
                        conversionRate = 1.0m;
                        unit = material.BaseUnit;
                    }
                    else
                    {
                        var conversion = await _uow.Repository<MaterialConversion>().Query()
                            .FirstOrDefaultAsync(c => c.MaterialId == item.MaterialId && c.AlternativeUnitId == unitId, ct)
                            ?? throw new BusinessException(ErrorCodes.DpInvalidUnit,
                                $"Đơn vị tính không được hỗ trợ cho vật tư '{material.Name}'.");

                        conversionRate = conversion.ConversionRate == 0 ? 1.0m : conversion.ConversionRate;
                        unit = await _uow.Repository<Domain.Entities.Unit>().Query()
                            .FirstOrDefaultAsync(u => u.UnitId == unitId, ct)
                            ?? throw new NotFoundException(nameof(Domain.Entities.Unit), unitId);
                    }
                }
                else
                {
                    // Không chọn: dùng đúng đơn vị VÀ tỷ lệ đã chốt trên dòng BOQ — không tra lại bảng
                    // quy đổi, vì dòng BOQ cũ vẫn hợp lệ kể cả khi đơn vị đó về sau bị gỡ khỏi bảng
                    // quy đổi của vật tư.
                    unitId = boq.UnitId;
                    conversionRate = boq.ConversionRate == 0 ? 1.0m : boq.ConversionRate;

                    unit = boq.Unit
                        ?? await _uow.Repository<Domain.Entities.Unit>().Query()
                            .FirstOrDefaultAsync(u => u.UnitId == unitId, ct)
                        ?? throw new NotFoundException(nameof(Domain.Entities.Unit), unitId);
                }

                decimal requiredBaseQty = item.Quantity / conversionRate;
                if (material.BaseUnit != null && material.BaseUnit.IsDiscrete && requiredBaseQty % 1 != 0)
                {
                    throw new BusinessException(ErrorCodes.InvalidUnitQuantity,
                        $"Vật tư '{material.Name}' được quản lý bằng đơn vị gốc '{material.BaseUnit.UnitName}' (số nguyên). Việc quy đổi {item.Quantity:0.###} {unit.UnitName} sẽ dẫn đến số lượng lẻ ({requiredBaseQty:0.###} {material.BaseUnit.UnitName}), hệ thống không cho phép.");
                }

                result.Add(new ResolvedDirectPurchaseItem
                {
                    MaterialId = material.MaterialId,
                    MaterialName = material.Name,
                    UnitId = unitId,
                    UnitName = unit.UnitName,
                    ConversionRate = conversionRate,
                    Quantity = item.Quantity,
                    UnitPrice = item.UnitPrice,
                });
            }

            return result;
        }

        public async Task<bool> EvaluateBoqAsync(
            long phaseId,
            long? excludeDirectPurchaseId,
            List<ResolvedDirectPurchaseItem> resolvedItems,
            CancellationToken ct)
        {
            if (resolvedItems.Count == 0) return false;

            var materialIds = resolvedItems.Select(i => i.MaterialId).Distinct().ToList();

            var boqItems = await _uow.Repository<BOQItem>().Query()
                .Where(b => b.PhaseId == phaseId && materialIds.Contains(b.MaterialId) && !b.IsDeleted)
                .AsNoTracking()
                .ToListAsync(ct);

            // InternalTransfer giữ chỗ định mức dù trạng thái kỹ thuật là Rejected.
            var mrConsumed = await _uow.Repository<MaterialRequestItem>().Query()
                .WhereCountsTowardBOQ()
                .Where(ri => ri.Request.PhaseId == phaseId &&
                             materialIds.Contains(ri.MaterialId))
                .GroupBy(ri => ri.MaterialId)
                .Select(g => new { MaterialId = g.Key, TotalBase = g.Sum(ri => ri.Quantity / (ri.ConversionRate == 0 ? 1m : ri.ConversionRate)) })
                .ToListAsync(ct);

            // Lũy kế từ Direct Purchase: chỉ loại Draft (chưa nhập kho).
            // Phiếu Rejected VẪN tính - hàng đã nhập kho, chỉ là không được hoàn tiền.
            var dpConsumed = await _uow.Repository<DirectPurchaseItem>().Query()
                .Where(di => di.DirectPurchaseRequest.PhaseId == phaseId &&
                             materialIds.Contains(di.MaterialId) &&
                             di.DirectPurchaseRequest.Status != DirectPurchaseStatus.Draft &&
                             (excludeDirectPurchaseId == null || di.DirectPurchaseId != excludeDirectPurchaseId.Value) &&
                             !di.DirectPurchaseRequest.IsDeleted)
                .GroupBy(di => di.MaterialId)
                .Select(g => new { MaterialId = g.Key, TotalBase = g.Sum(di => di.Quantity / (di.ConversionRate == 0 ? 1m : di.ConversionRate)) })
                .ToListAsync(ct);

            var mrMap = mrConsumed.ToDictionary(x => x.MaterialId, x => x.TotalBase);
            var dpMap = dpConsumed.ToDictionary(x => x.MaterialId, x => x.TotalBase);

            bool anyOver = false;

            foreach (var item in resolvedItems)
            {
                var boq = boqItems.FirstOrDefault(b => b.MaterialId == item.MaterialId);

                if (boq == null)
                {
                    // ResolveItemsAsync đã chặn vật tư ngoài BOQ, nên nhánh này chỉ xảy ra khi dòng
                    // BOQ bị xóa sau lúc soạn nháp. Đánh dấu vượt để phiếu không lọt qua im lặng.
                    item.IsOverBOQ = true;
                    item.Explanation = $"Vật tư '{item.MaterialName}' không còn trong định mức BOQ của giai đoạn.";
                    anyOver = true;
                    continue;
                }

                decimal boqLimitInBase = boq.Quantity / (boq.ConversionRate == 0 ? 1m : boq.ConversionRate);
                decimal consumedInBase = (mrMap.TryGetValue(item.MaterialId, out var mr) ? mr : 0m)
                                       + (dpMap.TryGetValue(item.MaterialId, out var dp) ? dp : 0m);

                if (consumedInBase + item.QuantityInBase > boqLimitInBase)
                {
                    decimal overInBase = consumedInBase + item.QuantityInBase - boqLimitInBase;
                    decimal cr = item.ConversionRate == 0 ? 1m : item.ConversionRate;
                    item.IsOverBOQ = true;
                    item.Explanation =
                        $"Vượt định mức BOQ {Math.Round(overInBase * cr, 3):0.###} {item.UnitName}.";
                    anyOver = true;
                }
                else
                {
                    item.IsOverBOQ = false;
                    item.Explanation = null;
                }
            }

            return anyOver;
        }

        public async Task MaterializeAsync(
            DirectPurchaseRequest dp,
            IReadOnlyList<DirectPurchaseItem> dpItems,
            long userId,
            CancellationToken ct)
        {
            decimal totalAmount = dpItems.Sum(i => i.LineTotal);

            // Hàng mua khẩn cấp luôn được giao thẳng tới công trường, nên địa điểm giao hàng là
            // địa chỉ dự án. Người mua không nhập tay như khi lập đơn hàng thông thường.
            var deliveryAddress = await _uow.Repository<Project>().Query()
                .Where(p => p.ProjectId == dp.ProjectId)
                .Select(p => p.Address)
                .FirstOrDefaultAsync(ct);

            // 1. PurchaseOrder tự sinh - hàng đã mua và đã về tới công trường
            var po = new PurchaseOrder
            {
                ProjectId = dp.ProjectId,
                SupplierId = null,
                PONumber = $"DP-PO-{dp.DirectPurchaseId:D6}",
                OrderDate = dp.PurchaseDate,
                ExpectedDeliveryDate = DateOnly.FromDateTime(dp.PurchaseDate),
                DeliveryAddress = deliveryAddress,
                Status = PurchaseOrderStatus.FullyReceived,
                TotalAmount = totalAmount,
                Notes = $"Tự động sinh từ phiếu mua khẩn cấp DP-{dp.DirectPurchaseId:D6}",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = userId,
            };

            await _uow.Repository<PurchaseOrder>().AddAsync(po, ct);
            await _uow.SaveChangesAsync(ct);

            var poItems = dpItems.Select(di => new PurchaseOrderItem
            {
                POId = po.POId,
                MaterialId = di.MaterialId,
                UnitId = di.UnitId,
                Quantity = di.Quantity,
                ConversionRate = di.ConversionRate,
                UnitPrice = di.UnitPrice,
                LineTotal = di.LineTotal,
            }).ToList();

            await _uow.Repository<PurchaseOrderItem>().AddRangeAsync(poItems, ct);
            await _uow.SaveChangesAsync(ct);

            // 2. GoodsReceipt tự sinh
            var gr = new GoodsReceipt
            {
                POId = po.POId,
                ReceiptNo = $"DP-GR-{dp.DirectPurchaseId:D6}",
                DelivererInfo = "Mua tại cửa hàng / mua ngoài khẩn cấp",
                DeliveryDocNo = $"INV-{dp.DirectPurchaseId:D6}",
                Status = GoodsReceiptStatus.Approved,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = userId,
            };

            await _uow.Repository<GoodsReceipt>().AddAsync(gr, ct);
            await _uow.SaveChangesAsync(ct);

            var grItems = dpItems.Select(di => new GoodsReceiptItem
            {
                ReceiptId = gr.ReceiptId,
                MaterialId = di.MaterialId,
                UnitId = di.UnitId,
                Quantity = di.Quantity,
                ConversionRate = di.ConversionRate,
            }).ToList();

            await _uow.Repository<GoodsReceiptItem>().AddRangeAsync(grItems, ct);
            await _uow.SaveChangesAsync(ct);

            // 3. Cộng tồn kho. Quy ước toàn hệ thống: base = Quantity / ConversionRate
            // (xem CreateGoodsReceiptCommandHandler / CancelGoodsReceiptCommandHandler).
            foreach (var di in dpItems)
            {
                decimal conversionRate = di.ConversionRate > 0 ? di.ConversionRate : 1m;
                decimal baseQty = di.Quantity / conversionRate;

                await _inventoryService.UpdateStockAsync(
                    dp.ProjectId,
                    di.MaterialId,
                    baseQty,
                    InventoryTransactionType.GoodsReceipt,
                    gr.ReceiptId,
                    EntityType.GoodsReceipt,
                    userId,
                    ct);
            }

            dp.AutoPOId = po.POId;
            dp.AutoReceiptId = gr.ReceiptId;
            dp.TotalAmount = totalAmount;
        }
    }
}
