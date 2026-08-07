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
    /// Đây là bước soát trước khi trình Giám đốc duyệt chi — áp dụng cho MỌI phiếu mua khẩn cấp,
    /// kể cả phiếu nằm trong định mức BOQ.
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

            // CỐ Ý không kiểm trạng thái dự án ở đây. Tới bước này vật tư đã nhập kho và người lập
            // phiếu đã bỏ tiền túi ra mua (xem SubmitDirectPurchaseCommandHandler). Chặn kiểm toán
            // khi dự án tạm dừng đồng nghĩa treo luôn khoản hoàn tiền của họ cho tới khi dự án chạy
            // lại — phạt nhầm người, trong khi khoản chi thì đã phát sinh rồi.
            // Điều kiện "dự án đang thi công" đã được chốt ở bước Gửi phiếu.

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
                // Mua khẩn cấp là khoản chi ngoài kế hoạch mua sắm, nên dù trong hay vượt định mức BOQ
                // vẫn phải có chữ ký Giám đốc mới được hoàn tiền. Kế toán chỉ xác nhận hóa đơn hợp lệ.
                dp.Status = DirectPurchaseStatus.WaitingApproval;
            }

            _uow.Repository<DirectPurchaseRequest>().Update(dp);
            await _uow.SaveChangesAsync(ct);

            await _realtimeSender.SendToGroupAsync(
                $"Project_{dp.ProjectId}", HubMethodNames.DirectPurchaseUpdated,
                new { DirectPurchaseId = dp.DirectPurchaseId }, ct);

            var accountant = await _uow.Repository<User>().GetByIdAsync(userId, ct);
            var accountantName = accountant?.FullName ?? "Kế toán";

            if (request.Approve)
            {
                await _notificationService.SendNotificationToRoleAsync(
                    UserRole.Director,
                    "Phiếu mua khẩn cấp chờ duyệt chi",
                    $"Kế toán '{accountantName}' đã đối chiếu hóa đơn phiếu DP-{dp.DirectPurchaseId:D6} " +
                    $"(giai đoạn '{dp.Phase?.Name}', dự án '{dp.Project?.Name}') và trình Giám đốc duyệt chi. " +
                    $"Tổng giá trị: {dp.TotalAmount:N0}đ. Vật tư đã nhập kho.",
                    NotificationType.Procurement, NotificationLink.ProjectDirectPurchases(dp.ProjectId), dp.DirectPurchaseId, ct);

                await _notificationService.SendNotificationAsync(
                    dp.RequestedBy,
                    "Phiếu mua khẩn cấp đã được trình Giám đốc",
                    $"Phiếu DP-{dp.DirectPurchaseId:D6} đã được Kế toán soát hóa đơn và trình Giám đốc duyệt chi.",
                    NotificationType.Procurement, NotificationLink.ProjectDirectPurchases(dp.ProjectId), dp.DirectPurchaseId, ct);

                return "Đã soát hóa đơn và trình Giám đốc duyệt chi.";
            }

            await _notificationService.SendNotificationAsync(
                dp.RequestedBy,
                "Phiếu mua khẩn cấp bị từ chối kiểm toán",
                $"Phiếu mua khẩn cấp DP-{dp.DirectPurchaseId:D6} bị từ chối kiểm toán, sẽ không được hoàn tiền. " +
                $"Vật tư vẫn đã nhập kho. Lý do: {dp.AuditNote}",
                NotificationType.Procurement, NotificationLink.ProjectDirectPurchases(dp.ProjectId), dp.DirectPurchaseId, ct);

            return "Đã từ chối kiểm toán. Phiếu sẽ không được hoàn tiền, vật tư vẫn nằm trong kho.";
        }
    }
}
