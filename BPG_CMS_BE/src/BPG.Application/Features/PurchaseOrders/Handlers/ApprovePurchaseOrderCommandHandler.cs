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
    public class ApprovePurchaseOrderCommandHandler : IRequestHandler<ApprovePurchaseOrderCommand, bool>
    {
        private readonly IUnitOfWork _uow;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;
        private readonly ICurrentUserService _currentUserService;

        public ApprovePurchaseOrderCommandHandler(
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

        public async Task<bool> Handle(ApprovePurchaseOrderCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            var po = await _uow.Repository<PurchaseOrder>().Query()
                .FirstOrDefaultAsync(p => p.POId == request.POId, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy đơn mua hàng cần duyệt.");

            if (po.Status != PurchaseOrderStatus.PendingApproval)
                throw new BusinessException(ErrorCodes.PoNotPendingApproval,
                    $"Đơn mua hàng đang ở trạng thái '{PurchaseOrderStatus.Label(po.Status)}'. " +
                    "Chỉ duyệt được đơn đang chờ Giám đốc duyệt.");

            // Duyệt xong đơn mới được gửi nhà cung cấp và mới cho phép lập phiếu nhập kho.
            po.Status = PurchaseOrderStatus.Sent;
            po.ApprovedBy = currentUserId;
            po.ApprovedAt = DateTime.UtcNow;
            po.ApprovalNote = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();

            await _uow.SaveChangesAsync(cancellationToken);

            await _realtimeSender.SendToGroupAsync(
                $"Project_{po.ProjectId}", "PurchaseOrderUpdated", new { POId = po.POId }, cancellationToken);

            var director = await _uow.Repository<User>().GetByIdAsync(currentUserId, cancellationToken);
            var directorName = director?.FullName ?? "Giám đốc";

            var notiTitle = "Đơn hàng đã được duyệt";
            var notiContent = $"Đơn hàng {po.PONumber} đã được Giám đốc '{directorName}' duyệt. " +
                              "Đơn có thể gửi nhà cung cấp và nhập kho.";

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
