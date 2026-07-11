using BPG.Application.Common.Models;
using BPG.Application.Features.GoodsReceipts.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
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

        public CreateGoodsReceiptCommandHandler(
            IUnitOfWork uow, 
            ICurrentUserService currentUserService,
            IInventoryService inventoryService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _inventoryService = inventoryService;
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

            // 2. Kiểm tra trạng thái dự án
            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", ValidationMessages.ProjectNotActive);
            }

            // 3. Kiểm tra trạng thái PO
            if (po.Status != PurchaseOrderStatus.Sent && po.Status != PurchaseOrderStatus.PartiallyReceived)
            {
                throw new BusinessException("ERR_INVALID_PO_STATUS", 
                    $"Không thể nhập kho cho đơn hàng có trạng thái: {po.Status}. Chỉ chấp nhận đơn hàng ở trạng thái Gửi (Sent) hoặc Nhận một phần (PartiallyReceived).");
            }

            // 4. Kiểm tra ảnh chụp chứng minh nếu có validation bắt buộc (tối đa 5 ảnh)
            if (request.Images != null && request.Images.Count > 5)
            {
                throw new BusinessException("ERR_MAX_IMAGES_EXCEEDED", "Tối đa chỉ được đính kèm 5 hình ảnh chứng từ giao nhận.");
            }

            // 5. Lấy tổng số lượng đã nhận của từng vật tư trong PO này từ trước đến nay
            var receivedQtyMap = await _uow.Repository<GoodsReceiptItem>().Query()
                .Where(gri => gri.Receipt.POId == request.POId && gri.Receipt.Status == GoodsReceiptStatus.Approved)
                .GroupBy(gri => gri.MaterialId)
                .Select(g => new { MaterialId = g.Key, TotalReceived = g.Sum(x => x.Quantity) })
                .ToDictionaryAsync(g => g.MaterialId, g => g.TotalReceived, cancellationToken);

            // 6. Bắt đầu validate chi tiết từng vật tư nhận đợt này
            foreach (var item in request.Items)
            {
                var poItem = po.Items.FirstOrDefault(pi => pi.MaterialId == item.MaterialId);
                if (poItem == null)
                {
                    throw new BusinessException("ERR_MATERIAL_NOT_IN_PO", 
                        $"Vật tư ID {item.MaterialId} không tồn tại trong đơn hàng PO này.");
                }

                if (item.Quantity <= 0)
                {
                    throw new BusinessException("ERR_INVALID_QUANTITY", 
                        $"Số lượng nhận của vật tư [{poItem.Material.Name}] phải lớn hơn 0.");
                }

                receivedQtyMap.TryGetValue(item.MaterialId, out decimal totalReceivedBefore);
                decimal remainingQty = poItem.Quantity - totalReceivedBefore;

                if (item.Quantity > remainingQty)
                {
                    throw new BusinessException("ERR_QUANTITY_EXCEEDED", 
                        $"Số lượng nhận ({item.Quantity}) vượt quá số lượng còn lại cần giao của PO cho vật tư [{poItem.Material.Name}] (còn thiếu {remainingQty}).");
                }
            }

            // 7. Bắt đầu transaction để ghi nhận nhập kho
            await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                // Sinh mã phiếu nhập kho chuẩn nghiệp vụ, ví dụ: GR-20240624-A3F8B2
                // Dùng UTC+7 (đúng giờ Việt Nam) + Guid để đảm bảo không trùng trong môi trường concurrent
                var vnNow = DateTime.UtcNow.AddHours(7);
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
                foreach (var item in request.Items)
                {
                    var poItem = po.Items.First(pi => pi.MaterialId == item.MaterialId);
                    
                    var gri = new GoodsReceiptItem
                    {
                        ReceiptId = goodsReceipt.ReceiptId,
                        MaterialId = item.MaterialId,
                        UnitId = item.UnitId,
                        Quantity = item.Quantity,
                        ConversionRate = poItem.ConversionRate
                    };
                    goodsReceiptItems.Add(gri);

                    // Chuyển đổi số lượng sang đơn vị cơ bản (Base Unit) để lưu vào CurrentInventory
                    decimal conversionRate = poItem.ConversionRate > 0 ? poItem.ConversionRate : 1;
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
                await _uow.CommitTransactionAsync(cancellationToken);

                return ApiResponse<long>.SuccessResult(goodsReceipt.ReceiptId, "Tạo phiếu nhập kho thành công.");
            }
            catch (Exception)
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }
        }
    }
}
