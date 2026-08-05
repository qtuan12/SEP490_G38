using BPG.Application.DTOs.DirectPurchases;
using BPG.Application.Features.DirectPurchases.Commands;
using BPG.Application.Features.DirectPurchases.Services;
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
    /// Gửi phiếu nháp. Điểm không thể quay lại: validate đầy đủ, tính lại BOQCheckStatus
    /// tại thời điểm gửi, sinh PO + GoodsReceipt và cộng tồn kho.
    /// Phiếu trong định mức -> Approved (chờ Kế toán kiểm toán để hoàn tiền).
    /// Phiếu vượt định mức  -> Pending  (Kế toán soát hóa đơn rồi trình Giám đốc).
    /// </summary>
    public class SubmitDirectPurchaseCommandHandler : IRequestHandler<SubmitDirectPurchaseCommand, string>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IDirectPurchaseFulfillmentService _fulfillment;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;

        public SubmitDirectPurchaseCommandHandler(
            IUnitOfWork uow,
            ICurrentUserService currentUserService,
            IDirectPurchaseFulfillmentService fulfillment,
            IRealtimeNotificationSender realtimeSender,
            INotificationService notificationService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _fulfillment = fulfillment;
            _realtimeSender = realtimeSender;
            _notificationService = notificationService;
        }

        public async Task<string> Handle(SubmitDirectPurchaseCommand request, CancellationToken ct)
        {
            long userId = _currentUserService.GetRequiredUserId();

            var dp = await _uow.Repository<DirectPurchaseRequest>().Query()
                .Include(r => r.Phase)
                .Include(r => r.Items)
                .FirstOrDefaultAsync(r => r.DirectPurchaseId == request.DirectPurchaseId && !r.IsDeleted, ct)
                ?? throw new NotFoundException("Không tìm thấy phiếu mua trực tiếp cần gửi.");

            if (dp.Status != DirectPurchaseStatus.Draft)
                throw new BusinessException(ErrorCodes.DpNotDraft,
                    $"Chỉ gửi được phiếu ở trạng thái Nháp. Trạng thái hiện tại: {DirectPurchaseStatus.Label(dp.Status)}.");

            if (dp.RequestedBy != userId)
                throw new ForbiddenException("Chỉ người tạo mới được gửi phiếu nháp này.");

            await DirectPurchaseGuard.EnsureCanManageAsync(_uow, _currentUserService, dp.ProjectId, userId, ct);

            // ---------- Validate đầy đủ tại thời điểm gửi ----------
            if (dp.Items.Count == 0)
                throw new BusinessException(ErrorCodes.DpNoItems, "Phải có ít nhất một vật tư trong phiếu mua khẩn cấp.");

            // Lý do mua khẩn cấp đồng thời là phần giải trình cho khoản vượt định mức,
            // nên không có ô giải trình riêng.
            if (string.IsNullOrWhiteSpace(dp.Reason))
                throw new BusinessException(ErrorCodes.DpNoReason, "Vui lòng nhập lý do mua khẩn cấp.");

            var invoiceCount = await _uow.Repository<Attachment>().Query()
                .CountAsync(a => a.EntityType == EntityType.DirectPurchaseRequest &&
                                 a.EntityId == dp.DirectPurchaseId &&
                                 a.AttachmentType == AttachmentType.InvoicePhoto &&
                                 !a.IsDeleted, ct);
            if (invoiceCount == 0)
                throw new BusinessException(ErrorCodes.DpNoInvoice, "Bắt buộc phải tải ảnh hóa đơn.");

            foreach (var item in dp.Items)
            {
                if (item.Quantity <= 0)
                    throw new BusinessException(ErrorCodes.DpInvalidQuantity, "Số lượng vật tư phải lớn hơn 0.");
                if (item.UnitPrice <= 0)
                    throw new BusinessException(ErrorCodes.DpInvalidUnitPrice, "Đơn giá vật tư phải lớn hơn 0.");
            }

            var project = await _uow.Repository<Project>().Query()
                .FirstOrDefaultAsync(p => p.ProjectId == dp.ProjectId, ct)
                ?? throw new NotFoundException("Không tìm thấy dự án của phiếu mua trực tiếp.");

            if (project.Status != ProjectStatus.InProgress)
                throw new BusinessException(ErrorCodes.DpProjectNotActive,
                    "Dự án hiện không ở trạng thái Đang thi công nên không thể gửi phiếu mua trực tiếp.");

            // Giai đoạn đã nghiệm thu thì đóng băng - phiếu nháp để lâu có thể rơi vào tình huống này.
            if (dp.Phase.Status == PhaseStatus.Approved)
                throw new BusinessException(ErrorCodes.DpPhaseFrozen,
                    $"Giai đoạn '{dp.Phase.Name}' đã được nghiệm thu và đóng băng, không thể gửi phiếu mua trực tiếp.");

            var purchaseDateOnly = DateOnly.FromDateTime(dp.PurchaseDate.Date);

            // Mua trực tiếp là hậu kiểm: hàng đã mua xong rồi mới lập phiếu, nên không thể mua ở tương lai.
            // Dùng UTC+7 (giờ Việt Nam) như các handler nhập/xuất/trả kho, tránh lệch ngày với người dùng.
            var todayVn = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7).Date);
            if (purchaseDateOnly > todayVn)
                throw new BusinessException(ErrorCodes.DpPurchaseDateInFuture,
                    $"Ngày mua ({purchaseDateOnly:dd/MM/yyyy}) không được sau ngày hôm nay ({todayVn:dd/MM/yyyy}). " +
                    "Phiếu mua trực tiếp chỉ ghi nhận khoản đã mua thực tế.");

            // Không bắt buộc nằm trong khoảng của giai đoạn: chỉ cần không sớm hơn ngày bắt đầu dự án
            // và không vượt quá ngày kết thúc giai đoạn.
            if (purchaseDateOnly < project.PlannedStart)
                throw new BusinessException(ErrorCodes.DpPurchaseDateBeforeProject,
                    $"Ngày mua ({purchaseDateOnly:dd/MM/yyyy}) phải từ ngày bắt đầu dự án '{project.Name}' ({project.PlannedStart:dd/MM/yyyy}) trở đi.");

            if (dp.Phase.EndDate.HasValue && purchaseDateOnly > dp.Phase.EndDate.Value)
                throw new BusinessException(ErrorCodes.DpPurchaseDateAfterPhase,
                    $"Ngày mua ({purchaseDateOnly:dd/MM/yyyy}) vượt quá ngày kết thúc giai đoạn '{dp.Phase.Name}' ({dp.Phase.EndDate.Value:dd/MM/yyyy}).");

            // ---------- Tính lại định mức BOQ TẠI THỜI ĐIỂM GỬI ----------
            // Phiếu khác có thể đã tiêu thụ hết định mức trong lúc bản nháp nằm chờ.
            var resolved = dp.Items.Select(i => new ResolvedDirectPurchaseItem
            {
                MaterialId = i.MaterialId,
                UnitId = i.UnitId,
                ConversionRate = i.ConversionRate,
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice,
            }).ToList();

            var materialNames = await _uow.Repository<MaterialCatalog>().Query()
                .Where(m => resolved.Select(r => r.MaterialId).Contains(m.MaterialId))
                .ToDictionaryAsync(m => m.MaterialId, m => m.Name, ct);
            var unitNames = await _uow.Repository<Domain.Entities.Unit>().Query()
                .Where(u => resolved.Select(r => r.UnitId).Contains(u.UnitId))
                .ToDictionaryAsync(u => u.UnitId, u => u.UnitName, ct);

            foreach (var r in resolved)
            {
                r.MaterialName = materialNames.TryGetValue(r.MaterialId, out var mn) ? mn : $"ID {r.MaterialId}";
                r.UnitName = unitNames.TryGetValue(r.UnitId, out var un) ? un : string.Empty;
            }

            bool anyOverBOQ = await _fulfillment.EvaluateBoqAsync(dp.PhaseId, dp.DirectPurchaseId, resolved, ct);

            await _uow.BeginTransactionAsync(ct);
            try
            {
                foreach (var item in dp.Items)
                {
                    var r = resolved.First(x => x.MaterialId == item.MaterialId);
                    item.IsOverBOQ = r.IsOverBOQ;
                    item.Explanation = r.Explanation;
                    item.LineTotal = item.Quantity * item.UnitPrice;
                    _uow.Repository<DirectPurchaseItem>().Update(item);
                }

                dp.BOQCheckStatus = anyOverBOQ ? BOQCheckStatus.OverBOQ : BOQCheckStatus.WithinBOQ;
                // Cả hai nhánh đều bắt đầu ở Pending. Approved chỉ được gán khi khoản chi thật sự
                // được chuẩn thuận (Kế toán soát xong nếu trong định mức, Giám đốc ký nếu vượt),
                // nên Approved luôn đồng nghĩa "sẽ được hoàn tiền".
                dp.Status = DirectPurchaseStatus.Pending;
                dp.AuditStatus = DirectPurchaseAuditStatus.PendingAudit;
                dp.SubmittedAt = DateTime.UtcNow;
                dp.UpdatedAt = DateTime.UtcNow;
                dp.UpdatedBy = userId;

                // Tồn kho được cộng ngay ở đây, KHÔNG chờ duyệt chi:
                // hàng đã mua và đã có mặt tại công trường.
                await _fulfillment.MaterializeAsync(dp, dp.Items.ToList(), userId, ct);

                _uow.Repository<DirectPurchaseRequest>().Update(dp);
                await _uow.SaveChangesAsync(ct);
                await _uow.CommitTransactionAsync(ct);
            }
            catch
            {
                await _uow.RollbackTransactionAsync(ct);
                throw;
            }

            await _realtimeSender.SendToGroupAsync(
                $"Project_{dp.ProjectId}", "DirectPurchaseUpdated",
                new { DirectPurchaseId = dp.DirectPurchaseId }, ct);

            var title = anyOverBOQ
                ? "Phiếu mua khẩn cấp VƯỢT ĐỊNH MỨC cần kiểm toán"
                : "Phiếu mua khẩn cấp mới cần kiểm toán";
            var content = anyOverBOQ
                ? $"Phiếu mua khẩn cấp DP-{dp.DirectPurchaseId:D6} (giai đoạn '{dp.Phase.Name}') vượt định mức BOQ. " +
                  $"Tổng giá trị: {dp.TotalAmount:N0}đ. Vật tư đã nhập kho. Vui lòng đối chiếu hóa đơn để trình Giám đốc duyệt chi."
                : $"Phiếu mua khẩn cấp DP-{dp.DirectPurchaseId:D6} vừa được gửi cho giai đoạn '{dp.Phase.Name}'. " +
                  $"Tổng giá trị: {dp.TotalAmount:N0}đ. Vui lòng kiểm toán để hoàn tiền/giải ngân.";

            await _notificationService.SendNotificationToRoleAsync(
                UserRole.Accountant, title, content,
                NotificationType.Procurement, NotificationLink.ProjectDirectPurchases(dp.ProjectId), dp.DirectPurchaseId, ct);

            return anyOverBOQ
                ? "Gửi phiếu thành công. Tồn kho đã được cập nhật. Phiếu vượt định mức BOQ nên đang chờ Kế toán soát hóa đơn để trình Giám đốc duyệt chi."
                : "Gửi phiếu thành công. Tồn kho đã được cập nhật, phiếu đang chờ Kế toán kiểm toán.";
        }
    }
}
