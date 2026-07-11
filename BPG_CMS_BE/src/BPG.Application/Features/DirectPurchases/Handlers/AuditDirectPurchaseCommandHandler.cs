using BPG.Application.Features.DirectPurchases.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.DirectPurchases.Handlers
{
    public class AuditDirectPurchaseCommandHandler : IRequestHandler<AuditDirectPurchaseCommand, bool>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;

        public AuditDirectPurchaseCommandHandler(
            IUnitOfWork uow,
            ICurrentUserService currentUserService,
            IRealtimeNotificationSender realtimeSender,
            INotificationService notificationService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _realtimeSender = realtimeSender;
            _notificationService = notificationService;
        }

        public async Task<bool> Handle(AuditDirectPurchaseCommand request, CancellationToken ct)
        {
            long userId = _currentUserService.GetRequiredUserId();

            var dp = await _uow.Repository<DirectPurchaseRequest>().Query()
                .FirstOrDefaultAsync(r => r.DirectPurchaseId == request.DirectPurchaseId, ct)
                ?? throw new NotFoundException(nameof(DirectPurchaseRequest), request.DirectPurchaseId);

            if (dp.AuditStatus != DirectPurchaseAuditStatus.PendingAudit)
                throw new BusinessException("ALREADY_AUDITED",
                    "Phiếu này đã được kiểm toán, không thể thao tác lại.");

            if (!request.Approve && string.IsNullOrWhiteSpace(request.AuditNote))
                throw new BusinessException("NOTE_REQUIRED",
                    "Vui lòng nhập lý do khi từ chối kiểm toán.");

            dp.AuditStatus = request.Approve
                ? DirectPurchaseAuditStatus.Audited
                : DirectPurchaseAuditStatus.Rejected;
            dp.AuditedBy = userId;
            dp.AuditedAt = DateTime.UtcNow;
            dp.AuditNote = request.AuditNote?.Trim();

            _uow.Repository<DirectPurchaseRequest>().Update(dp);
            await _uow.SaveChangesAsync(ct);

            await _realtimeSender.SendToGroupAsync(
                $"Project_{dp.ProjectId}", "DirectPurchaseUpdated",
                new { DirectPurchaseId = dp.DirectPurchaseId }, ct);

            // Thông báo cho người tạo phiếu biết kết quả kiểm toán hoàn tiền/giải ngân
            var notiTitle = request.Approve
                ? "Phiếu mua khẩn cấp đã được kiểm toán"
                : "Phiếu mua khẩn cấp bị từ chối kiểm toán";
            var notiContent = request.Approve
                ? $"Phiếu mua khẩn cấp DP-{dp.DirectPurchaseId:D6} đã được kiểm toán và xác nhận hoàn tiền/giải ngân."
                : $"Phiếu mua khẩn cấp DP-{dp.DirectPurchaseId:D6} bị từ chối kiểm toán. Lý do: {dp.AuditNote}";

            await _notificationService.SendNotificationAsync(
                dp.RequestedBy, notiTitle, notiContent,
                NotificationType.Procurement, NotificationReferenceType.DirectPurchaseRequest, dp.DirectPurchaseId, ct);

            return true;
        }
    }
}
