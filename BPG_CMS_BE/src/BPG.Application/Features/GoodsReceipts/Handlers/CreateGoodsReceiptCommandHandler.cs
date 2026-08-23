using BPG.Application.Common.Models;
using BPG.Application.Features.GoodsReceipts.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Common;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.GoodsReceipts.Handlers
{
    public class CreateGoodsReceiptCommandHandler : IRequestHandler<CreateGoodsReceiptCommand, ApiResponse<long>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IInventoryService _inventoryService;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;
        private readonly ILogger<CreateGoodsReceiptCommandHandler>? _logger;

        public CreateGoodsReceiptCommandHandler(
            IUnitOfWork uow,
            ICurrentUserService currentUserService,
            IInventoryService inventoryService,
            IRealtimeNotificationSender realtimeSender,
            INotificationService notificationService,
            ILogger<CreateGoodsReceiptCommandHandler>? logger = null)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _inventoryService = inventoryService;
            _realtimeSender = realtimeSender;
            _notificationService = notificationService;
            _logger = logger;
        }

        public async Task<ApiResponse<long>> Handle(CreateGoodsReceiptCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            if (request.Items == null || !request.Items.Any())
            {
                throw new BusinessException("ERR_EMPTY_ITEMS", "Danh sách vật tư nhận thực tế không được để trống.");
            }

            // 1. Kiểm tra đơn hàng PO tồn tại
            var po = await _uow.Repository<PurchaseOrder>().Query()
                .Include(p => p.Request)
                    .ThenInclude(r => r!.Phase)
                        .ThenInclude(ph => ph!.Project)
                .Include(p => p.Items)
                    .ThenInclude(pi => pi!.Material)
                        .ThenInclude(m => m!.BaseUnit)
                .Include(p => p.Items)
                    .ThenInclude(pi => pi!.Unit)
                .FirstOrDefaultAsync(p => p.POId == request.POId, cancellationToken);

            if (po == null)
            {
                throw new NotFoundException(nameof(PurchaseOrder), request.POId);
            }

            var project = po.Request?.Phase?.Project;
            if (project == null)
            {
                throw new BusinessException("ERR_PROJECT_NOT_FOUND", "Không tìm thấy dự án liên kết với đơn mua hàng này.");
            }

            var isProjectLeader = await _uow.Repository<ProjectMember>().AnyAsync(
                member => member.ProjectId == project.ProjectId && member.UserId == currentUserId && member.IsLeader,
                cancellationToken);
            if (!isProjectLeader)
                throw new ForbiddenException("Chỉ Trưởng dự án của đơn mua hàng mới được tạo phiếu nhập kho.");

            // 2. Kiểm tra trạng thái dự án
            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", ValidationMessages.ProjectNotActive);
            }

            // 3. Kiểm tra trạng thái PO — đơn chưa được Giám đốc duyệt thì chưa được nhập kho
            if (po.Status == PurchaseOrderStatus.PendingApproval)
            {
                throw new BusinessException(ErrorCodes.PoNotApproved,
                    "Đơn hàng đang chờ Giám đốc duyệt, chưa thể nhập kho.");
            }

            if (po.Status != PurchaseOrderStatus.Sent && po.Status != PurchaseOrderStatus.PartiallyReceived)
            {
                throw new BusinessException("ERR_INVALID_PO_STATUS",
                    $"Không thể nhập kho cho đơn hàng có trạng thái: {PurchaseOrderStatus.Label(po.Status)}. Chỉ chấp nhận đơn hàng ở trạng thái Đã đặt hàng hoặc Nhận một phần.");
            }

            // 4. Kiểm tra ảnh chụp chứng minh nếu có validation bắt buộc (tối đa 5 ảnh)
            // if (request.Images != null && request.Images.Count > 5)
            // {
            //     throw new BusinessException("ERR_MAX_IMAGES_EXCEEDED", "Tối đa chỉ được đính kèm 5 hình ảnh chứng từ giao nhận.");
            // }

            // 5. Lấy tổng số lượng đã nhận của từng vật tư trong PO này từ trước đến nay
            await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var lockResource = $"GoodsReceipt_PO_{request.POId}";
                await _uow.ExecuteSqlAsync(
                    $"EXEC sp_getapplock @Resource = {lockResource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction'",
                    cancellationToken);

            var currentStatus = await _uow.Repository<PurchaseOrder>().Query()
                .AsNoTracking()
                .Where(currentPo => currentPo.POId == request.POId)
                .Select(currentPo => currentPo.Status)
                .FirstAsync(cancellationToken);

            if (currentStatus != PurchaseOrderStatus.Sent && currentStatus != PurchaseOrderStatus.PartiallyReceived)
            {
                throw new BusinessException("ERR_INVALID_PO_STATUS",
                    $"Purchase order status changed to {PurchaseOrderStatus.Label(currentStatus)} and can no longer receive goods.");
            }

            var receivedQtyMap = await _uow.Repository<GoodsReceiptItem>().Query()
                .AsNoTracking()
                .Where(gri => gri.Receipt.POId == request.POId && gri.Receipt.Status == GoodsReceiptStatus.Approved)
                .GroupBy(gri => gri.MaterialId)
                .Select(g => new { MaterialId = g.Key, TotalReceived = g.Sum(x => x.Quantity) })
                .ToDictionaryAsync(g => g.MaterialId, g => g.TotalReceived, cancellationToken);

            // 6. Bắt đầu validate chi tiết từng vật tư nhận đợt này
            var validItems = new List<CreateGoodsReceiptItemDto>();
            foreach (var item in request.Items)
            {
                var poItem = po.Items.FirstOrDefault(pi => pi.MaterialId == item.MaterialId);
                if (poItem == null)
                {
                    throw new BusinessException("ERR_MATERIAL_NOT_IN_PO",
                        $"Vật tư ID {item.MaterialId} không tồn tại trong đơn hàng này.");
                }

                if (item.UnitId != poItem.UnitId)
                {
                    throw new BusinessException("ERR_INVALID_RECEIPT_UNIT",
                        $"Unit ID {item.UnitId} does not match the unit recorded on the purchase order for material [{poItem.Material.Name}].");
                }

                if (item.Quantity < 0)
                {
                    throw new BusinessException("ERR_INVALID_QUANTITY",
                        $"Số lượng nhận của vật tư [{poItem.Material.Name}] phải lớn hơn hoặc bằng 0.");
                }

                if (item.Quantity == 0)
                {
                    continue; // Bỏ qua vật tư không nhận đợt này (giao bù sau)
                }

                decimal receivedBaseQty = item.Quantity / poItem.ConversionRate;
                if (poItem.Material?.BaseUnit != null && poItem.Material.BaseUnit.IsDiscrete && receivedBaseQty % 1 != 0)
                {
                    throw new BusinessException(ErrorCodes.InvalidUnitQuantity,
                        $"Vật tư [{poItem.Material.Name}] được quản lý bằng đơn vị gốc '{poItem.Material.BaseUnit.UnitName}' (số nguyên). Việc nhận {item.Quantity} {poItem.Unit?.UnitName ?? ""} sẽ dẫn đến tồn kho lẻ ({receivedBaseQty} {poItem.Material.BaseUnit.UnitName}), hệ thống không cho phép.");
                }

                receivedQtyMap.TryGetValue(item.MaterialId, out decimal totalReceivedBefore);
                decimal remainingQty = poItem.Quantity - totalReceivedBefore;

                if (item.Quantity > remainingQty)
                {
                    throw new BusinessException("ERR_QUANTITY_EXCEEDED",
                        $"Số lượng nhận ({item.Quantity}) vượt quá số lượng còn lại cần giao của đơn hàng cho vật tư [{poItem.Material.Name}] (còn thiếu {remainingQty}).");
                }

                validItems.Add(item);
            }

            if (!validItems.Any())
            {
                throw new BusinessException("ERR_EMPTY_ITEMS", "Danh sách vật tư nhận thực tế phải chứa ít nhất một vật tư có số lượng lớn hơn 0.");
            }

                // Sinh mã phiếu nhập kho chuẩn nghiệp vụ, ví dụ: GR-20240624-A3F8B2
                // Dùng giờ Việt Nam + Guid để đảm bảo không trùng trong môi trường concurrent
                var vnNow = VietnamTime.Now;
                var receiptNo = $"GR-{vnNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

                var goodsReceipt = new GoodsReceipt
                {
                    POId = request.POId,
                    ReceiptNo = receiptNo,
                    DelivererInfo = request.DelivererInfo,
                    DeliveryDocNo = request.DeliveryDocNo,
                    Status = GoodsReceiptStatus.Approved, // Nghiệm thu nhập kho ngay lập tức
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = currentUserId
                };

                await _uow.Repository<GoodsReceipt>().AddAsync(goodsReceipt, cancellationToken);
                await _uow.SaveChangesAsync(cancellationToken); // để lấy GoodsReceiptId

                var goodsReceiptItems = new List<GoodsReceiptItem>();

                // Xử lý từng vật tư nhận
                foreach (var item in validItems)
                {
                    var poItem = po.Items.First(pi => pi.MaterialId == item.MaterialId);

                    var gri = new GoodsReceiptItem
                    {
                        ReceiptId = goodsReceipt.ReceiptId,
                        MaterialId = item.MaterialId,
                        UnitId = item.UnitId,
                        Quantity = item.Quantity,
                        ConversionRate = await ResolveConversionRateAsync(poItem, cancellationToken)
                    };
                    goodsReceiptItems.Add(gri);

                    // Chuyển đổi số lượng sang đơn vị cơ bản (Base Unit) để lưu vào CurrentInventory
                    decimal conversionRate = gri.ConversionRate;
                    decimal baseQty = item.Quantity / conversionRate;

                    // Gọi InventoryService để cập nhật tồn kho ảo và ghi nhận Thẻ kho đồng thời
                    await _inventoryService.UpdateStockAsync(
                        project.ProjectId,
                        item.MaterialId,
                        baseQty,
                        InventoryTransactionType.GoodsReceipt,
                        goodsReceipt.ReceiptId,
                        EntityType.GoodsReceipt,
                        currentUserId,
                        cancellationToken);
                }

                await _uow.Repository<GoodsReceiptItem>().AddRangeAsync(goodsReceiptItems, cancellationToken);
                await _uow.SaveChangesAsync(cancellationToken);

                // Lưu ảnh đính kèm (nếu có)
                if (request.Images != null && request.Images.Any())
                {
                    var attachments = request.Images.Select(url => new Attachment
                    {
                        EntityType = EntityType.GoodsReceipt,
                        EntityId = goodsReceipt.ReceiptId,
                        AttachmentType = AttachmentType.DeliveryPhoto,
                        FileName = Path.GetFileName(url) ?? "delivery_photo.jpg",
                        FileUrl = url,
                        ContentType = "image/jpeg",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUserId,
                        IsDeleted = false
                    }).ToList();

                    await _uow.Repository<Attachment>().AddRangeAsync(attachments, cancellationToken);
                }

                // 8. Cập nhật trạng thái đơn hàng PO
                bool allReceived = true;
                foreach (var poItem in po.Items)
                {
                    decimal incomingQty = request.Items.FirstOrDefault(i => i.MaterialId == poItem.MaterialId)?.Quantity ?? 0;
                    receivedQtyMap.TryGetValue(poItem.MaterialId, out decimal totalReceivedBefore);

                    if (totalReceivedBefore + incomingQty < poItem.Quantity)
                    {
                        allReceived = false;
                        break;
                    }
                }

                po.Status = allReceived ? PurchaseOrderStatus.FullyReceived : PurchaseOrderStatus.PartiallyReceived;
                po.UpdatedAt = DateTime.UtcNow;
                po.UpdatedBy = currentUserId;
                _uow.Repository<PurchaseOrder>().Update(po);

                await _uow.SaveChangesAsync(cancellationToken);

                var actorName = await _uow.Repository<User>().Query()
                    .AsNoTracking()
                    .Where(u => u.UserId == currentUserId)
                    .Select(u => u.FullName)
                    .FirstOrDefaultAsync(cancellationToken) ?? "Người dùng";

                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.Accountant,
                    "Có phiếu nhập kho mới",
                    $"{actorName} đã tạo phiếu nhập kho {goodsReceipt.ReceiptNo} cho đơn mua {po.PONumber} tại dự án {project.Name}.",
                    NotificationType.Procurement,
                    currentUserId,
                    $"/projects/{project.ProjectId}?tab=inventory&subTab=receipts&receiptId={goodsReceipt.ReceiptId}",
                    goodsReceipt.ReceiptId,
                    cancellationToken);

                await _uow.CommitTransactionAsync(cancellationToken);

                try
                {
                    // Realtime: broadcast to members viewing this project's inventory workspace
                    await _realtimeSender.SendToGroupAsync(
                        HubMethodNames.GroupProject + project.ProjectId,
                        HubMethodNames.GoodsReceiptChanged,
                        goodsReceipt.ReceiptId,
                        cancellationToken);

                    // Realtime: broadcast to members viewing global inventory (Project_0)
                    await _realtimeSender.SendToGroupAsync(
                        HubMethodNames.GroupProject + 0,
                        HubMethodNames.GoodsReceiptChanged,
                        goodsReceipt.ReceiptId,
                        cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex,
                        "Goods receipt {ReceiptId} was committed, but post-commit realtime broadcast failed for project {ProjectId}.",
                        goodsReceipt.ReceiptId,
                        project.ProjectId);
                }

                return ApiResponse<long>.SuccessResult(goodsReceipt.ReceiptId, "Tạo phiếu nhập kho thành công.");
            }
            catch (Exception)
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }
        }

        private async Task<decimal> ResolveConversionRateAsync(PurchaseOrderItem poItem, CancellationToken cancellationToken)
        {
            var baseUnitId = poItem.Material.BaseUnitId != 0
                ? poItem.Material.BaseUnitId
                : poItem.Material.BaseUnit?.UnitId;

            if (baseUnitId == poItem.UnitId)
            {
                return 1;
            }

            var conversion = await _uow.Repository<MaterialConversion>().Query()
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.MaterialId == poItem.MaterialId
                    && item.AlternativeUnitId == poItem.UnitId, cancellationToken);

            if (conversion == null || conversion.ConversionRate <= 0)
            {
                throw new BusinessException("ERR_INVALID_MATERIAL_CONVERSION",
                    $"Không tìm thấy tỷ lệ quy đổi hợp lệ cho vật tư [{poItem.Material.Name}] và đơn vị [{poItem.Unit.UnitName}].");
            }

            return conversion.ConversionRate;
        }
    }
}
