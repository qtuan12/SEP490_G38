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
    public class RejectPurchaseOrderCommandHandler : IRequestHandler<RejectPurchaseOrderCommand, bool>
    {
        private readonly IUnitOfWork _uow;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;
        private readonly ICurrentUserService _currentUserService;

        public RejectPurchaseOrderCommandHandler(
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

        public async Task<bool> Handle(RejectPurchaseOrderCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Reason))
                throw new BusinessException(ErrorCodes.PoRejectReasonRequired,
                    "Vui lòng nhập lý do từ chối đơn mua hàng.");

            var currentUserId = _currentUserService.GetRequiredUserId();

            var po = await _uow.Repository<PurchaseOrder>().Query()
                .FirstOrDefaultAsync(p => p.POId == request.POId, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy đơn mua hàng cần từ chối.");

            if (po.Status != PurchaseOrderStatus.PendingApproval)
                throw new BusinessException(ErrorCodes.PoNotPendingApproval,
                    $"Đơn mua hàng đang ở trạng thái '{PurchaseOrderStatus.Label(po.Status)}'. " +
                    "Chỉ từ chối được đơn đang chờ Giám đốc duyệt.");

            // Đơn bị từ chối không còn giữ chỗ số lượng của yêu cầu vật tư — kế toán có thể lập đơn khác.
            po.Status = PurchaseOrderStatus.Rejected;
            po.RejectedReason = request.Reason.Trim();
            po.ApprovedBy = currentUserId;
            po.ApprovedAt = DateTime.UtcNow;

            await _uow.SaveChangesAsync(cancellationToken);

            await _realtimeSender.SendToGroupAsync(
                $"Project_{po.ProjectId}", "PurchaseOrderUpdated", new { POId = po.POId }, cancellationToken);

            var director = await _uow.Repository<User>().GetByIdAsync(currentUserId, cancellationToken);
            var directorName = director?.FullName ?? "Giám đốc";

            var notiTitle = "Đơn hàng bị từ chối";
            var notiContent = $"Đơn hàng {po.PONumber} đã bị Giám đốc '{directorName}' từ chối. " +
                              $"Lý do: {po.RejectedReason}";

            await _notificationService.SendNotificationToRoleAsync(
                UserRole.Accountant, notiTitle, notiContent,
                NotificationType.Procurement, NotificationLink.ProjectPurchaseOrders(po.ProjectId), po.POId, cancellationToken);

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
