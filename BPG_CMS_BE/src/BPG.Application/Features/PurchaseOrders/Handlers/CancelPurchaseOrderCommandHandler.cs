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
            if (string.IsNullOrWhiteSpace(request.Reason))
                throw new BusinessException(ErrorCodes.PoCancelReasonRequired, "Vui lòng nhập lý do hủy đơn mua hàng.");

            var po = await _uow.Repository<PurchaseOrder>().Query()
                .FirstOrDefaultAsync(p => p.POId == request.POId, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy đơn mua hàng cần hủy.");

            if (po.Status == PurchaseOrderStatus.Cancelled)
                throw new BusinessException(ErrorCodes.PoAlreadyCancelled, "Đơn mua hàng đã bị hủy trước đó.");

            if (po.Status == PurchaseOrderStatus.Rejected)
                throw new BusinessException(ErrorCodes.PoCannotCancel,
                    "Đơn mua hàng đã bị Giám đốc từ chối, không cần hủy nữa.");

            if (po.Status == PurchaseOrderStatus.PartiallyReceived ||
                po.Status == PurchaseOrderStatus.FullyReceived ||
                po.Status == PurchaseOrderStatus.Closed)
                throw new BusinessException(ErrorCodes.PoCannotCancel,
                    "Không thể hủy đơn mua hàng đã có hàng nhận hoặc đã đóng.");

            // Check no approved goods receipts exist
            var hasReceipts = await _uow.Repository<GoodsReceipt>().Query()
                .AnyAsync(gr => gr.POId == request.POId && gr.Status == GoodsReceiptStatus.Approved,
                    cancellationToken);

            if (hasReceipts)
                throw new BusinessException(ErrorCodes.PoHasReceipts,
                    "Không thể hủy đơn mua hàng đã có phiếu nhập kho được duyệt.");

            po.Status = PurchaseOrderStatus.Cancelled;
            po.CancelledReason = request.Reason.Trim();

            await _uow.SaveChangesAsync(cancellationToken);

            await _realtimeSender.SendToGroupAsync(
                $"Project_{po.ProjectId}", HubMethodNames.PurchaseOrderUpdated, new { POId = po.POId }, cancellationToken);

            // Thông báo cho những người liên quan: kế toán và trưởng dự án
            var notiTitle = "Đơn hàng đã bị hủy";
            var notiContent = $"Đơn hàng {po.PONumber} đã bị hủy. Lý do: {po.CancelledReason}";

            var currentUserId = _currentUserService.UserId;
            if (currentUserId.HasValue)
            {
                await _notificationService.SendNotificationToRoleAsync(
                    UserRole.Accountant, notiTitle, notiContent,
                    NotificationType.Procurement, currentUserId.Value, NotificationLink.ProjectPurchaseOrders(po.ProjectId), po.POId, cancellationToken);
            }
            else
            {
                await _notificationService.SendNotificationToRoleAsync(
                    UserRole.Accountant, notiTitle, notiContent,
                    NotificationType.Procurement, NotificationLink.ProjectPurchaseOrders(po.ProjectId), po.POId, cancellationToken);
            }

            var projectLeaderId = await _uow.Repository<ProjectMember>().Query()
                .Where(m => m.ProjectId == po.ProjectId && m.IsLeader && m.UserId != currentUserId)
                .Select(m => m.UserId)
                .FirstOrDefaultAsync(cancellationToken);

            if (projectLeaderId > 0)
                await _notificationService.SendNotificationAsync(
                    projectLeaderId, notiTitle, notiContent,
                    NotificationType.Procurement, NotificationLink.ProjectPurchaseOrders(po.ProjectId), po.POId, cancellationToken);

            return true;
        }
    }
}
