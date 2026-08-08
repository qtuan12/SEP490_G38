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
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.GoodsReceipts.Handlers
{
    public class CancelGoodsReceiptCommandHandler : IRequestHandler<CancelGoodsReceiptCommand, ApiResponse<bool>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IInventoryService _inventoryService;
        private readonly IRealtimeNotificationSender _realtimeSender;

        public CancelGoodsReceiptCommandHandler(
            IUnitOfWork uow, 
            ICurrentUserService currentUserService,
            IInventoryService inventoryService,
            IRealtimeNotificationSender realtimeSender)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _inventoryService = inventoryService;
            _realtimeSender = realtimeSender;
        }

        public async Task<ApiResponse<bool>> Handle(CancelGoodsReceiptCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            // 1. Tìm phiếu nhập kho kèm chi tiết
            var receipt = await _uow.Repository<GoodsReceipt>().Query()
                .Include(gr => gr.Items)
                .Include(gr => gr.PurchaseOrder)
                    .ThenInclude(p => p!.Request)
                        .ThenInclude(r => r!.Phase)
                            .ThenInclude(ph => ph!.Project)
                .Include(gr => gr.PurchaseOrder)
                    .ThenInclude(p => p!.Items)
                        .ThenInclude(pi => pi!.Material)
                .FirstOrDefaultAsync(gr => gr.ReceiptId == request.ReceiptId, cancellationToken);

            if (receipt == null)
            {
                throw new NotFoundException(nameof(GoodsReceipt), request.ReceiptId);
            }

            // 2. Kiểm tra nếu phiếu đã bị hủy trước đó
            if (receipt.Status == GoodsReceiptStatus.Cancelled)
            {
                throw new BusinessException("ERR_RECEIPT_ALREADY_CANCELLED", "Phiếu nhập kho này đã được hủy từ trước.");
            }

            var po = receipt.PurchaseOrder;
            if (po == null)
            {
                throw new BusinessException("ERR_PO_NOT_FOUND", "Không tìm thấy đơn mua hàng PO liên kết với phiếu nhập kho này.");
            }

            var project = po.Request?.Phase?.Project;
            if (project == null)
            {
                throw new BusinessException("ERR_PROJECT_NOT_FOUND", "Không tìm thấy dự án liên kết với phiếu nhập kho này.");
            }

            var isProjectLeader = await _uow.Repository<ProjectMember>().AnyAsync(
                member => member.ProjectId == project.ProjectId && member.UserId == currentUserId && member.IsLeader,
                cancellationToken);
            if (!isProjectLeader)
                throw new ForbiddenException("Chỉ Trưởng dự án mới được hủy phiếu nhập kho.");

            // 3. Kiểm tra trạng thái dự án
            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", "Dự án liên kết không còn hoạt động, không thể hủy phiếu nhập kho.");
            }

            // 3.5 Kiểm tra trạng thái PO
            if (po.Status == PurchaseOrderStatus.Closed)
            {
                throw new BusinessException("ERR_PO_CLOSED", "Đơn mua hàng PO liên kết đã đóng, không thể hủy phiếu nhập kho.");
            }

            // 3.6 Kiểm tra hạn hủy phiếu từ SystemConfig
            var config = await _uow.Repository<SystemConfig>().Query()
                .FirstOrDefaultAsync(x => x.ConfigKey == SystemConfigKeys.CancellationDays, cancellationToken);
            int limitDays = config != null && int.TryParse(config.ConfigValue, out var parsedDays) ? parsedDays : 7;

            if (DateTime.UtcNow - receipt.CreatedAt > TimeSpan.FromDays(limitDays))
            {
                throw new BusinessException("ERR_CANCEL_TIME_EXCEEDED",
                    $"Phiếu nhập kho đã được tạo quá {limitDays} ngày (hạn hủy tối đa theo cấu hình hệ thống), không thể thực hiện hủy. " +
                    "Vui lòng lập Phiếu Điều Chỉnh Kho để hiệu chỉnh số liệu.");
            }

            // 4. KIỂM TRA TỒN KHO KHẢ DỤNG: Đảm bảo hàng chưa bị xuất dùng hoặc đóng băng cho công việc khác
            foreach (var item in receipt.Items)
            {
                decimal conversionRate = item.ConversionRate > 0 ? item.ConversionRate : 1;
                decimal baseQty = item.Quantity / conversionRate;

                var inv = await _uow.Repository<CurrentInventory>().Query()
                    .FirstOrDefaultAsync(ci => ci.ProjectId == project.ProjectId && ci.MaterialId == item.MaterialId, cancellationToken);

                // Check tồn kho khả dụng (Available = Quantity - ReservedQuantity)
                if (inv == null || (inv.Quantity - inv.ReservedQuantity) < baseQty)
                {
                    var poItem = po.Items.FirstOrDefault(pi => pi.MaterialId == item.MaterialId);
                    string matName = poItem?.Material?.Name ?? $"ID {item.MaterialId}";
                    decimal availableQty = inv != null ? (inv.Quantity - inv.ReservedQuantity) : 0;
                    throw new BusinessException("ERR_INSUFFICIENT_INVENTORY",
                        $"Không thể hủy phiếu nhập kho. Vật tư [{matName}] đã được xuất dùng hoặc đóng băng cho kế hoạch thi công " +
                        $"(tồn kho khả dụng hiện tại chỉ còn {availableQty.ToString("G29")}, yêu cầu hoàn trả {baseQty.ToString("G29")}). Vui lòng lập Phiếu Điều Chỉnh Kho.");
                }
            }

            // 5. Thực thi hủy trong Transaction
            await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                // Cập nhật trạng thái phiếu nhập kho thành Cancelled
                receipt.Status = GoodsReceiptStatus.Cancelled;
                receipt.UpdatedAt = DateTime.UtcNow;
                receipt.UpdatedBy = currentUserId;
                _uow.Repository<GoodsReceipt>().Update(receipt);

                // Khấu trừ tồn kho thực tế và ghi nhận Thẻ kho (ledger) đảo ngược qua InventoryService
                foreach (var item in receipt.Items)
                {
                    decimal conversionRate = item.ConversionRate > 0 ? item.ConversionRate : 1;
                    decimal baseQty = item.Quantity / conversionRate;

                    await _inventoryService.UpdateStockAsync(
                        project.ProjectId,
                        item.MaterialId,
                        -baseQty,
                        InventoryTransactionType.Adjustment,
                        receipt.ReceiptId,
                        EntityType.GoodsReceiptReversal,
                        currentUserId,
                        cancellationToken);
                }

                // 6. Tính toán và cập nhật lại trạng thái đơn hàng PO
                // Lấy tổng số lượng đã nhận thực tế từ tất cả các phiếu nhập kho KHÁC của PO này (mà đang ở trạng thái Approved)
                var otherReceivedMap = await _uow.Repository<GoodsReceiptItem>().Query()
                    .Where(gri => gri.Receipt.POId == receipt.POId && gri.Receipt.Status == GoodsReceiptStatus.Approved && gri.ReceiptId != receipt.ReceiptId)
                    .GroupBy(gri => gri.MaterialId)
                    .Select(g => new { MaterialId = g.Key, TotalReceived = g.Sum(x => x.Quantity) })
                    .ToDictionaryAsync(g => g.MaterialId, g => g.TotalReceived, cancellationToken);

                bool hasAnyReceived = false;
                bool allReceived = true;

                foreach (var poItem in po.Items)
                {
                    otherReceivedMap.TryGetValue(poItem.MaterialId, out decimal totalReceived);
                    
                    if (totalReceived > 0)
                    {
                        hasAnyReceived = true;
                    }

                    if (totalReceived < poItem.Quantity)
                    {
                        allReceived = false;
                    }
                }

                if (allReceived)
                {
                    po.Status = PurchaseOrderStatus.FullyReceived;
                }
                else if (hasAnyReceived)
                {
                    po.Status = PurchaseOrderStatus.PartiallyReceived;
                }
                else
                {
                    po.Status = PurchaseOrderStatus.Sent; // Trở lại trạng thái ban đầu chưa nhận đợt nào
                }

                po.UpdatedAt = DateTime.UtcNow;
                po.UpdatedBy = currentUserId;
                _uow.Repository<PurchaseOrder>().Update(po);

                await _uow.SaveChangesAsync(cancellationToken);
                await _uow.CommitTransactionAsync(cancellationToken);

                // Realtime: broadcast to members viewing this project's inventory workspace
                await _realtimeSender.SendToGroupAsync(
                    HubMethodNames.GroupProject + project.ProjectId,
                    HubMethodNames.GoodsReceiptChanged,
                    receipt.ReceiptId,
                    cancellationToken);

                // Realtime: broadcast to members viewing global inventory (Project_0)
                await _realtimeSender.SendToGroupAsync(
                    HubMethodNames.GroupProject + 0,
                    HubMethodNames.GoodsReceiptChanged,
                    receipt.ReceiptId,
                    cancellationToken);

                return ApiResponse<bool>.SuccessResult(true, "Hủy phiếu nhập kho thành công.");
            }
            catch (Exception)
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }
        }
    }
}
