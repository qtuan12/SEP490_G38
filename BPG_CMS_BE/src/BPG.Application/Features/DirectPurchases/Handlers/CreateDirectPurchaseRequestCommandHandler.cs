using BPG.Application.Features.DirectPurchases.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UserRole = BPG.Domain.Constants.UserRole;

namespace BPG.Application.Features.DirectPurchases.Handlers
{
    public class CreateDirectPurchaseRequestCommandHandler : IRequestHandler<CreateDirectPurchaseRequestCommand, long>
    {
        private readonly IUnitOfWork _uow;
        private readonly IInventoryService _inventoryService;
        private readonly ICurrentUserService _currentUserService;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;

        public CreateDirectPurchaseRequestCommandHandler(
            IUnitOfWork uow,
            IInventoryService inventoryService,
            ICurrentUserService currentUserService,
            IRealtimeNotificationSender realtimeSender,
            INotificationService notificationService)
        {
            _uow = uow;
            _inventoryService = inventoryService;
            _currentUserService = currentUserService;
            _realtimeSender = realtimeSender;
            _notificationService = notificationService;
        }

        public async Task<long> Handle(CreateDirectPurchaseRequestCommand request, CancellationToken ct)
        {
            if (request.Items.Count == 0)
                throw new BusinessException("NO_ITEMS", "Phải có ít nhất một vật tư trong phiếu mua khẩn cấp.");

            if (request.InvoicePhotoUrls.Count == 0)
                throw new BusinessException("NO_INVOICE", "Bắt buộc phải tải ảnh hóa đơn.");

            long userId = _currentUserService.GetRequiredUserId();

            // Validate ngày mua nằm trong khoảng thời gian thi công của giai đoạn
            var phase = await _uow.Repository<Phase>().Query()
                .FirstOrDefaultAsync(p => p.PhaseId == request.PhaseId, ct)
                ?? throw new NotFoundException(nameof(Phase), request.PhaseId);

            var purchaseDateOnly = DateOnly.FromDateTime(request.PurchaseDate.Date);

            if (phase.StartDate.HasValue && purchaseDateOnly < phase.StartDate.Value)
                throw new BusinessException("ERR_PURCHASE_DATE_BEFORE_PHASE",
                    $"Ngày mua ({purchaseDateOnly:dd/MM/yyyy}) phải từ ngày bắt đầu giai đoạn '{phase.Name}' ({phase.StartDate.Value:dd/MM/yyyy}) trở đi.");

            if (phase.EndDate.HasValue && purchaseDateOnly > phase.EndDate.Value)
                throw new BusinessException("ERR_PURCHASE_DATE_AFTER_PHASE",
                    $"Ngày mua ({purchaseDateOnly:dd/MM/yyyy}) vượt quá ngày kết thúc giai đoạn '{phase.Name}' ({phase.EndDate.Value:dd/MM/yyyy}).");

            // Load BOQ items for this phase
            var boqItems = await _uow.Repository<BOQItem>().Query()
                .Include(b => b.Unit)
                .Where(b => b.PhaseId == request.PhaseId && !b.IsDeleted)
                .ToListAsync(ct);

            var materialIds = request.Items.Select(i => i.MaterialId).Distinct().ToList();

            // Validate all materials are in BOQ
            foreach (var item in request.Items)
            {
                if (!boqItems.Any(b => b.MaterialId == item.MaterialId))
                    throw new BusinessException("NOT_IN_BOQ",
                        $"Vật tư ID {item.MaterialId} không có trong BOQ của giai đoạn này. Chỉ được mua vật tư theo định mức BOQ.");
            }

            // Check BOQ remaining for each material
            var mrConsumedMap = await _uow.Repository<MaterialRequestItem>().Query()
                .Where(ri => ri.Request.PhaseId == request.PhaseId &&
                             materialIds.Contains(ri.MaterialId) &&
                             ri.Request.Status != MaterialRequestStatus.Rejected &&
                             ri.Request.Status != MaterialRequestStatus.Cancelled &&
                             !ri.Request.IsDeleted)
                .GroupBy(ri => ri.MaterialId)
                .Select(g => new { MaterialId = g.Key, TotalBase = g.Sum(ri => ri.Quantity / (ri.ConversionRate == 0 ? 1m : ri.ConversionRate)) })
                .ToListAsync(ct);

            var dpConsumedMap = await _uow.Repository<DirectPurchaseItem>().Query()
                .Where(di => di.DirectPurchaseRequest.PhaseId == request.PhaseId &&
                             materialIds.Contains(di.MaterialId) &&
                             di.DirectPurchaseRequest.Status != DirectPurchaseStatus.Rejected &&
                             !di.DirectPurchaseRequest.IsDeleted)
                .GroupBy(di => di.MaterialId)
                .Select(g => new { MaterialId = g.Key, TotalBase = g.Sum(di => di.Quantity / (di.ConversionRate == 0 ? 1m : di.ConversionRate)) })
                .ToListAsync(ct);

            var mrMap = mrConsumedMap.ToDictionary(x => x.MaterialId, x => x.TotalBase);
            var dpMap = dpConsumedMap.ToDictionary(x => x.MaterialId, x => x.TotalBase);

            foreach (var item in request.Items)
            {
                var boq = boqItems.First(b => b.MaterialId == item.MaterialId);
                decimal boqLimitInBase = boq.Quantity / (boq.ConversionRate == 0 ? 1m : boq.ConversionRate);
                decimal consumedInBase = (mrMap.TryGetValue(item.MaterialId, out var mr) ? mr : 0)
                                       + (dpMap.TryGetValue(item.MaterialId, out var dp) ? dp : 0);
                decimal newQtyInBase = item.Quantity / (boq.ConversionRate == 0 ? 1m : boq.ConversionRate);

                if (consumedInBase + newQtyInBase > boqLimitInBase)
                {
                    decimal remainingInUnit = (boqLimitInBase - consumedInBase) * (boq.ConversionRate == 0 ? 1m : boq.ConversionRate);
                    throw new BusinessException("EXCEEDS_BOQ",
                        $"Vật tư '{boq.Material?.Name ?? item.MaterialId.ToString()}' vượt định mức BOQ. " +
                        $"Số lượng còn được phép mua: {Math.Max(0, remainingInUnit):0.###} {boq.Unit?.UnitName}. " +
                        $"Vui lòng tạo Yêu cầu vật tư vượt định mức (có giải trình sự cố và chờ Giám đốc duyệt).");
                }
            }

            await _uow.BeginTransactionAsync(ct);
            try
            {
                decimal totalAmount = request.Items.Sum(i => i.Quantity * i.UnitPrice);

                // 1. Create DirectPurchaseRequest
                var dp = new DirectPurchaseRequest
                {
                    ProjectId = request.ProjectId,
                    PhaseId = request.PhaseId,
                    TaskId = request.TaskId,
                    RequestedBy = userId,
                    Reason = request.Reason.Trim(),
                    Status = DirectPurchaseStatus.Approved,
                    AuditStatus = DirectPurchaseAuditStatus.PendingAudit,
                    TotalAmount = totalAmount,
                    PurchaseDate = request.PurchaseDate,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userId,
                };

                await _uow.Repository<DirectPurchaseRequest>().AddAsync(dp);
                await _uow.SaveChangesAsync(ct);

                // 2. Create DP items
                var dpItems = request.Items.Select(i =>
                {
                    var boq = boqItems.First(b => b.MaterialId == i.MaterialId);
                    return new DirectPurchaseItem
                    {
                        DirectPurchaseId = dp.DirectPurchaseId,
                        MaterialId = i.MaterialId,
                        UnitId = boq.UnitId,
                        Quantity = i.Quantity,
                        ConversionRate = boq.ConversionRate,
                        UnitPrice = i.UnitPrice,
                        LineTotal = i.Quantity * i.UnitPrice,
                    };
                }).ToList();

                await _uow.Repository<DirectPurchaseItem>().AddRangeAsync(dpItems);
                await _uow.SaveChangesAsync(ct);

                // 3. Auto-create PurchaseOrder
                string poNumber = $"DP-PO-{dp.DirectPurchaseId:D6}";
                var po = new PurchaseOrder
                {
                    ProjectId = request.ProjectId,
                    SupplierId = null,
                    PONumber = poNumber,
                    OrderDate = request.PurchaseDate,
                    ExpectedDeliveryDate = DateOnly.FromDateTime(request.PurchaseDate),
                    Status = PurchaseOrderStatus.FullyReceived,
                    TotalAmount = totalAmount,
                    Notes = $"Tự động sinh từ phiếu mua khẩn cấp DP-{dp.DirectPurchaseId:D6}",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userId,
                };

                await _uow.Repository<PurchaseOrder>().AddAsync(po);
                await _uow.SaveChangesAsync(ct);

                // 4. Create PO items
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

                await _uow.Repository<PurchaseOrderItem>().AddRangeAsync(poItems);
                await _uow.SaveChangesAsync(ct);

                // 5. Auto-create GoodsReceipt
                string grNumber = $"DP-GR-{dp.DirectPurchaseId:D6}";
                var gr = new GoodsReceipt
                {
                    POId = po.POId,
                    ReceiptNo = grNumber,
                    DelivererInfo = "Mua tại cửa hàng / mua ngoài khẩn cấp",
                    DeliveryDocNo = $"INV-{dp.DirectPurchaseId:D6}",
                    Status = GoodsReceiptStatus.Approved,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userId,
                };

                await _uow.Repository<GoodsReceipt>().AddAsync(gr);
                await _uow.SaveChangesAsync(ct);

                // 6. Create GR items
                var grItems = dpItems.Select(di => new GoodsReceiptItem
                {
                    ReceiptId = gr.ReceiptId,
                    MaterialId = di.MaterialId,
                    UnitId = di.UnitId,
                    Quantity = di.Quantity,
                    ConversionRate = di.ConversionRate,
                }).ToList();

                await _uow.Repository<GoodsReceiptItem>().AddRangeAsync(grItems);
                await _uow.SaveChangesAsync(ct);

                // 7. Update inventory for each item
                foreach (var di in dpItems)
                {
                    decimal baseQty = di.ConversionRate > 0 ? di.Quantity * di.ConversionRate : di.Quantity;
                    await _inventoryService.UpdateStockAsync(
                        request.ProjectId,
                        di.MaterialId,
                        baseQty,
                        InventoryTransactionType.GoodsReceipt,
                        gr.ReceiptId,
                        EntityType.GoodsReceipt,
                        userId,
                        ct);
                }

                // 8. Save invoice photo attachments
                foreach (var url in request.InvoicePhotoUrls)
                {
                    var attachment = new Attachment
                    {
                        EntityType = EntityType.DirectPurchaseRequest,
                        EntityId = dp.DirectPurchaseId,
                        AttachmentType = AttachmentType.InvoicePhoto,
                        FileName = Path.GetFileName(new Uri(url).AbsolutePath),
                        FileUrl = url,
                        ContentType = "image/jpeg",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = userId,
                    };
                    await _uow.Repository<Attachment>().AddAsync(attachment);
                }
                await _uow.SaveChangesAsync(ct);

                // 9. Link back
                dp.AutoPOId = po.POId;
                dp.AutoReceiptId = gr.ReceiptId;
                _uow.Repository<DirectPurchaseRequest>().Update(dp);
                await _uow.SaveChangesAsync(ct);

                await _uow.CommitTransactionAsync(ct);

                await _realtimeSender.SendToGroupAsync(
                    $"Project_{request.ProjectId}", "DirectPurchaseUpdated",
                    new { DirectPurchaseId = dp.DirectPurchaseId }, ct);

                // Thông báo cho Kế toán: phiếu mới cần kiểm toán để hoàn tiền/giải ngân
                await _notificationService.SendNotificationToRoleAsync(
                    UserRole.Accountant,
                    "Phiếu mua khẩn cấp mới cần kiểm toán",
                    $"Phiếu mua khẩn cấp DP-{dp.DirectPurchaseId:D6} vừa được tạo cho giai đoạn '{phase.Name}'. " +
                    $"Tổng giá trị: {totalAmount:N0}đ. Vui lòng kiểm toán để hoàn tiền/giải ngân.",
                    NotificationType.Procurement, NotificationReferenceType.DirectPurchaseRequest, dp.DirectPurchaseId, ct);

                return dp.DirectPurchaseId;
            }
            catch
            {
                await _uow.RollbackTransactionAsync(ct);
                throw;
            }
        }
    }
}
