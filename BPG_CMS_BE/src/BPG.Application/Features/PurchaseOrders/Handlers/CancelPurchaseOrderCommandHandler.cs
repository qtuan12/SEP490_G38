using BPG.Application.Features.PurchaseOrders.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UserRole = BPG.Domain.Constants.UserRole;

namespace BPG.Application.Features.PurchaseOrders.Handlers
{
    public class CancelPurchaseOrderCommandHandler : IRequestHandler<CancelPurchaseOrderCommand, bool>
    {
        private readonly IUnitOfWork _uow;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;
        private readonly ICurrentUserService _currentUserService;

        public CancelPurchaseOrderCommandHandler(
            IUnitOfWork uow,
            IRealtimeNotificationSender realtimeSender,
            INotificationService notificationService,
            ICurrentUserService currentUserService)
        {
            _uow = uow;
            _realtimeSender = realtimeSender;
            _notificationService = notificationService;
            _currentUserService = currentUserService;
        }

        public async Task<bool> Handle(CancelPurchaseOrderCommand request, CancellationToken cancellationToken)
        {
            var po = await _uow.Repository<PurchaseOrder>().Query()
                .Include(p => p.Request).ThenInclude(r => r!.Phase)
                .FirstOrDefaultAsync(p => p.POId == request.POId, cancellationToken)
                ?? throw new NotFoundException(nameof(PurchaseOrder), request.POId);

            if (po.Status == PurchaseOrderStatus.Cancelled)
                throw new BusinessException("ERR_PO_ALREADY_CANCELLED", "Đơn mua hàng đã bị hủy trước đó.");

            if (po.Status == PurchaseOrderStatus.PartiallyReceived ||
                po.Status == PurchaseOrderStatus.FullyReceived ||
                po.Status == PurchaseOrderStatus.Closed)
                throw new BusinessException("ERR_PO_CANNOT_CANCEL",
                    "Không thể hủy đơn mua hàng đã có hàng nhận hoặc đã đóng.");

            // Check no approved goods receipts exist
            var hasReceipts = await _uow.Repository<GoodsReceipt>().Query()
                .AnyAsync(gr => gr.POId == request.POId && gr.Status == GoodsReceiptStatus.Approved,
                    cancellationToken);

            if (hasReceipts)
                throw new BusinessException("ERR_PO_HAS_RECEIPTS",
                    "Không thể hủy đơn mua hàng đã có phiếu nhập kho được duyệt.");

            po.Status = PurchaseOrderStatus.Cancelled;
            po.CancelledReason = request.Reason.Trim();

            await _uow.SaveChangesAsync(cancellationToken);

            var projectId = po.ProjectId ?? po.Request?.Phase.ProjectId;
            if (projectId.HasValue)
                await _realtimeSender.SendToGroupAsync(
                    $"Project_{projectId.Value}", "PurchaseOrderUpdated", new { POId = po.POId }, cancellationToken);

            // Thông báo cho những người liên quan: kế toán và trưởng dự án
            var notiTitle = "Đơn hàng đã bị hủy";
            var notiContent = $"Đơn hàng {po.PONumber} đã bị hủy. Lý do: {po.CancelledReason}";

            await _notificationService.SendNotificationToRoleAsync(
                UserRole.Accountant, notiTitle, notiContent,
                NotificationType.Procurement, NotificationReferenceType.PurchaseOrder, po.POId, cancellationToken);

            if (projectId.HasValue)
            {
                var currentUserId = _currentUserService.UserId;
                var projectLeaderId = await _uow.Repository<ProjectMember>().Query()
                    .Where(m => m.ProjectId == projectId.Value && m.IsLeader && m.UserId != currentUserId)
                    .Select(m => m.UserId)
                    .FirstOrDefaultAsync(cancellationToken);

                if (projectLeaderId > 0)
                    await _notificationService.SendNotificationAsync(
                        projectLeaderId, notiTitle, notiContent,
                        NotificationType.Procurement, NotificationReferenceType.PurchaseOrder, po.POId, cancellationToken);
            }

            return true;
        }
    }
}
