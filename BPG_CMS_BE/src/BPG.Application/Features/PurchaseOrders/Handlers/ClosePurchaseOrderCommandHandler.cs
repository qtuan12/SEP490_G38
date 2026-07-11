using BPG.Application.Features.PurchaseOrders.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PurchaseOrders.Handlers
{
    /// <summary>
    /// Kế toán đóng PO đang nhận một phần. Phần vật tư chưa nhận không còn bị PO này
    /// giữ chỗ nữa, cho phép tạo PO khác từ cùng yêu cầu vật tư cho phần còn thiếu.
    /// Không hoàn hay hủy phần đã nhận — tồn kho giữ nguyên.
    /// </summary>
    public class ClosePurchaseOrderCommandHandler : IRequestHandler<ClosePurchaseOrderCommand, bool>
    {
        private readonly IUnitOfWork _uow;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;
        private readonly ICurrentUserService _currentUserService;

        public ClosePurchaseOrderCommandHandler(
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

        public async Task<bool> Handle(ClosePurchaseOrderCommand request, CancellationToken cancellationToken)
        {
            var po = await _uow.Repository<PurchaseOrder>().Query()
                .Include(p => p.Request).ThenInclude(r => r!.Phase)
                .FirstOrDefaultAsync(p => p.POId == request.POId, cancellationToken)
                ?? throw new NotFoundException(nameof(PurchaseOrder), request.POId);

            if (po.Status != PurchaseOrderStatus.PartiallyReceived)
                throw new BusinessException("ERR_PO_CANNOT_CLOSE",
                    "Chỉ có thể đóng đơn mua hàng đang ở trạng thái nhận một phần.");

            if (string.IsNullOrWhiteSpace(request.Reason))
                throw new BusinessException("ERR_CLOSE_REASON_REQUIRED", "Vui lòng nhập lý do đóng đơn mua hàng.");

            po.Status = PurchaseOrderStatus.Closed;
            po.ClosedReason = request.Reason.Trim();

            await _uow.SaveChangesAsync(cancellationToken);

            var projectId = po.ProjectId ?? po.Request?.Phase.ProjectId;
            if (projectId.HasValue)
                await _realtimeSender.SendToGroupAsync(
                    $"Project_{projectId.Value}", "PurchaseOrderUpdated", new { POId = po.POId }, cancellationToken);

            // Thông báo cho trưởng dự án: vật tư chưa nhận đã được trả lại yêu cầu vật tư, có thể tạo đơn hàng khác.
            // Không cần báo lại vai trò Kế toán vì chỉ Kế toán mới có quyền thực hiện thao tác này.
            if (projectId.HasValue)
            {
                var currentUserId = _currentUserService.UserId;
                var projectLeaderId = await _uow.Repository<ProjectMember>().Query()
                    .Where(m => m.ProjectId == projectId.Value && m.IsLeader && m.UserId != currentUserId)
                    .Select(m => m.UserId)
                    .FirstOrDefaultAsync(cancellationToken);

                if (projectLeaderId > 0)
                    await _notificationService.SendNotificationAsync(
                        projectLeaderId,
                        "Đơn hàng đã được đóng",
                        $"Đơn hàng {po.PONumber} đã được đóng. Phần vật tư chưa nhận được trả lại yêu cầu vật tư để tạo đơn hàng khác. Lý do: {po.ClosedReason}",
                        NotificationType.Procurement, NotificationReferenceType.PurchaseOrder, po.POId, cancellationToken);
            }

            return true;
        }
    }
}
