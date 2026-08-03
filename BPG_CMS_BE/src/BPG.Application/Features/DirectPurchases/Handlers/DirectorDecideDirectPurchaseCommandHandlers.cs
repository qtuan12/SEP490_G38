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
    /// Giám đốc quyết định duyệt chi cho phiếu mua trực tiếp vượt định mức BOQ.
    /// Quyết định này KHÔNG ảnh hưởng tồn kho - vật tư đã nhập kho từ bước Submit.
    /// </summary>
    public class ApproveDirectPurchaseByDirectorCommandHandler
        : IRequestHandler<ApproveDirectPurchaseByDirectorCommand, bool>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;

        public ApproveDirectPurchaseByDirectorCommandHandler(
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

        public async Task<bool> Handle(ApproveDirectPurchaseByDirectorCommand request, CancellationToken ct)
        {
            long userId = _currentUserService.GetRequiredUserId();

            var dp = await DirectPurchaseDirectorDecision.LoadWaitingApprovalAsync(_uow, request.DirectPurchaseId, ct);

            dp.Status = DirectPurchaseStatus.Approved;
            dp.ApprovedBy = userId;
            dp.ApprovedAt = DateTime.UtcNow;
            dp.ApprovalNote = request.ApprovalNote?.Trim();
            dp.UpdatedAt = DateTime.UtcNow;
            dp.UpdatedBy = userId;

            _uow.Repository<DirectPurchaseRequest>().Update(dp);
            await _uow.SaveChangesAsync(ct);

            await _realtimeSender.SendToGroupAsync(
                $"Project_{dp.ProjectId}", "DirectPurchaseUpdated",
                new { DirectPurchaseId = dp.DirectPurchaseId }, ct);

            var director = await _uow.Repository<User>().GetByIdAsync(userId, ct);
            var directorName = director?.FullName ?? "Giám đốc";

            await _notificationService.SendNotificationAsync(
                dp.RequestedBy,
                "Phiếu mua khẩn cấp vượt định mức đã được duyệt chi",
                $"Phiếu DP-{dp.DirectPurchaseId:D6} đã được Giám đốc '{directorName}' duyệt chi. Khoản tiền sẽ được hoàn/giải ngân.",
                NotificationType.Procurement, NotificationLink.ProjectDirectPurchases(dp.ProjectId), dp.DirectPurchaseId, ct);

            await _notificationService.SendNotificationToRoleAsync(
                UserRole.Accountant,
                "Phiếu mua khẩn cấp vượt định mức đã được duyệt chi",
                $"Giám đốc '{directorName}' đã duyệt chi phiếu DP-{dp.DirectPurchaseId:D6} " +
                $"(giai đoạn '{dp.Phase?.Name}', dự án '{dp.Project?.Name}'). Tổng giá trị: {dp.TotalAmount:N0}đ. " +
                $"Vui lòng tiến hành hoàn tiền/giải ngân.",
                NotificationType.Procurement, NotificationLink.ProjectDirectPurchases(dp.ProjectId), dp.DirectPurchaseId, ct);

            return true;
        }
    }

    public class RejectDirectPurchaseByDirectorCommandHandler
        : IRequestHandler<RejectDirectPurchaseByDirectorCommand, bool>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;

        public RejectDirectPurchaseByDirectorCommandHandler(
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

        public async Task<bool> Handle(RejectDirectPurchaseByDirectorCommand request, CancellationToken ct)
        {
            long userId = _currentUserService.GetRequiredUserId();

            if (string.IsNullOrWhiteSpace(request.Reason))
                throw new BusinessException(ErrorCodes.DpRejectionReasonRequired,
                    "Bắt buộc phải nhập lý do từ chối duyệt chi.");

            var dp = await DirectPurchaseDirectorDecision.LoadWaitingApprovalAsync(_uow, request.DirectPurchaseId, ct);

            dp.Status = DirectPurchaseStatus.Rejected;
            dp.ApprovedBy = userId;
            dp.ApprovedAt = DateTime.UtcNow;
            dp.ApprovalNote = $"Từ chối: {request.Reason.Trim()}";
            dp.UpdatedAt = DateTime.UtcNow;
            dp.UpdatedBy = userId;

            _uow.Repository<DirectPurchaseRequest>().Update(dp);
            await _uow.SaveChangesAsync(ct);

            await _realtimeSender.SendToGroupAsync(
                $"Project_{dp.ProjectId}", "DirectPurchaseUpdated",
                new { DirectPurchaseId = dp.DirectPurchaseId }, ct);

            var director = await _uow.Repository<User>().GetByIdAsync(userId, ct);
            var directorName = director?.FullName ?? "Giám đốc";

            await _notificationService.SendNotificationAsync(
                dp.RequestedBy,
                "Phiếu mua khẩn cấp vượt định mức bị từ chối duyệt chi",
                $"Phiếu DP-{dp.DirectPurchaseId:D6} bị Giám đốc '{directorName}' từ chối duyệt chi, sẽ không được hoàn tiền. " +
                $"Vật tư vẫn đã nhập kho và vẫn tính vào định mức giai đoạn. Lý do: {request.Reason.Trim()}",
                NotificationType.Procurement, NotificationLink.ProjectDirectPurchases(dp.ProjectId), dp.DirectPurchaseId, ct);

            await _notificationService.SendNotificationToRoleAsync(
                UserRole.Accountant,
                "Phiếu mua khẩn cấp bị từ chối duyệt chi",
                $"Giám đốc '{directorName}' đã từ chối duyệt chi phiếu DP-{dp.DirectPurchaseId:D6}. Không thực hiện hoàn tiền/giải ngân.",
                NotificationType.Procurement, NotificationLink.ProjectDirectPurchases(dp.ProjectId), dp.DirectPurchaseId, ct);

            return true;
        }
    }

    internal static class DirectPurchaseDirectorDecision
    {
        public static async Task<DirectPurchaseRequest> LoadWaitingApprovalAsync(
            IUnitOfWork uow, long directPurchaseId, CancellationToken ct)
        {
            var dp = await uow.Repository<DirectPurchaseRequest>().Query()
                .Include(r => r.Phase)
                .Include(r => r.Project)
                .FirstOrDefaultAsync(r => r.DirectPurchaseId == directPurchaseId && !r.IsDeleted, ct)
                ?? throw new NotFoundException("Không tìm thấy phiếu mua trực tiếp cần duyệt chi.");

            if (dp.Status != DirectPurchaseStatus.WaitingApproval)
                throw new BusinessException(ErrorCodes.DpInvalidStatusForApproval,
                    $"Phiếu mua trực tiếp đang ở trạng thái '{DirectPurchaseStatus.Label(dp.Status)}'. " +
                    "Chỉ duyệt chi được phiếu đang ở trạng thái 'Chờ Giám đốc'.");

            return dp;
        }
    }
}
