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
    /// <summary>
    /// Kế toán đối chiếu hóa đơn. Không ảnh hưởng tồn kho.
    /// - Phiếu trong định mức: đây là bước cuối, duyệt xong là hoàn tiền.
    /// - Phiếu vượt định mức: đây là bước soát trước khi trình Giám đốc duyệt chi.
    /// </summary>
    public class AuditDirectPurchaseCommandHandler : IRequestHandler<AuditDirectPurchaseCommand, string>
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

        public async Task<string> Handle(AuditDirectPurchaseCommand request, CancellationToken ct)
        {
            long userId = _currentUserService.GetRequiredUserId();

            var dp = await _uow.Repository<DirectPurchaseRequest>().Query()
                .Include(r => r.Phase)
                .Include(r => r.Project)
                .FirstOrDefaultAsync(r => r.DirectPurchaseId == request.DirectPurchaseId && !r.IsDeleted, ct)
                ?? throw new NotFoundException("Không tìm thấy phiếu mua trực tiếp cần kiểm toán.");

            if (dp.Status == DirectPurchaseStatus.Draft)
                throw new BusinessException(ErrorCodes.DpNotSubmitted,
                    "Phiếu còn ở trạng thái Nháp, chưa được gửi nên chưa thể kiểm toán.");

            if (dp.AuditStatus != DirectPurchaseAuditStatus.PendingAudit)
                throw new BusinessException(ErrorCodes.DpAlreadyAudited,
                    "Phiếu này đã được kiểm toán, không thể thao tác lại.");

            if (!request.Approve && string.IsNullOrWhiteSpace(request.AuditNote))
                throw new BusinessException(ErrorCodes.DpAuditNoteRequired,
                    "Vui lòng nhập lý do khi từ chối kiểm toán.");

            bool isOverBOQ = dp.BOQCheckStatus == BOQCheckStatus.OverBOQ;

            dp.AuditedBy = userId;
            dp.AuditedAt = DateTime.UtcNow;
            dp.AuditNote = request.AuditNote?.Trim();
            dp.UpdatedAt = DateTime.UtcNow;
            dp.UpdatedBy = userId;

            if (!request.Approve)
            {
                dp.AuditStatus = DirectPurchaseAuditStatus.Rejected;
                dp.Status = DirectPurchaseStatus.Rejected;
            }
            else
            {
                dp.AuditStatus = DirectPurchaseAuditStatus.Audited;
                // Vượt định mức: hóa đơn hợp lệ nhưng khoản chi vượt BOQ vẫn cần Giám đốc ký.
                // Trong định mức: không ai phải ký thêm, Kế toán soát xong là chốt duyệt chi.
                dp.Status = isOverBOQ
                    ? DirectPurchaseStatus.WaitingApproval
                    : DirectPurchaseStatus.Approved;
            }

            _uow.Repository<DirectPurchaseRequest>().Update(dp);
            await _uow.SaveChangesAsync(ct);

            await _realtimeSender.SendToGroupAsync(
                $"Project_{dp.ProjectId}", "DirectPurchaseUpdated",
                new { DirectPurchaseId = dp.DirectPurchaseId }, ct);

            var accountant = await _uow.Repository<User>().GetByIdAsync(userId, ct);
            var accountantName = accountant?.FullName ?? "Kế toán";

            if (dp.Status == DirectPurchaseStatus.WaitingApproval)
            {
                await _notificationService.SendNotificationToRoleAsync(
                    UserRole.Director,
                    "Phiếu mua khẩn cấp vượt định mức chờ duyệt chi",
                    $"Kế toán '{accountantName}' đã đối chiếu hóa đơn phiếu DP-{dp.DirectPurchaseId:D6} " +
                    $"(giai đoạn '{dp.Phase?.Name}', dự án '{dp.Project?.Name}') và trình Giám đốc duyệt chi vượt định mức. " +
                    $"Tổng giá trị: {dp.TotalAmount:N0}đ. Vật tư đã nhập kho.",
                    NotificationType.Procurement, NotificationLink.ProjectDirectPurchases(dp.ProjectId), dp.DirectPurchaseId, ct);

                await _notificationService.SendNotificationAsync(
                    dp.RequestedBy,
                    "Phiếu mua khẩn cấp đã được trình Giám đốc",
                    $"Phiếu DP-{dp.DirectPurchaseId:D6} vượt định mức đã được Kế toán soát hóa đơn và trình Giám đốc duyệt chi.",
                    NotificationType.Procurement, NotificationLink.ProjectDirectPurchases(dp.ProjectId), dp.DirectPurchaseId, ct);

                return "Đã soát hóa đơn và trình Giám đốc duyệt chi khoản vượt định mức.";
            }

            var notiTitle = request.Approve
                ? "Phiếu mua khẩn cấp đã được kiểm toán"
                : "Phiếu mua khẩn cấp bị từ chối kiểm toán";
            var notiContent = request.Approve
                ? $"Phiếu mua khẩn cấp DP-{dp.DirectPurchaseId:D6} đã được kiểm toán và xác nhận hoàn tiền/giải ngân."
                : $"Phiếu mua khẩn cấp DP-{dp.DirectPurchaseId:D6} bị từ chối kiểm toán, sẽ không được hoàn tiền. " +
                  $"Vật tư vẫn đã nhập kho. Lý do: {dp.AuditNote}";

            await _notificationService.SendNotificationAsync(
                dp.RequestedBy, notiTitle, notiContent,
                NotificationType.Procurement, NotificationLink.ProjectDirectPurchases(dp.ProjectId), dp.DirectPurchaseId, ct);

            return request.Approve
                ? "Đã xác nhận kiểm toán. Phiếu được duyệt chi và hoàn tiền."
                : "Đã từ chối kiểm toán. Phiếu sẽ không được hoàn tiền, vật tư vẫn nằm trong kho.";
        }
    }
}
