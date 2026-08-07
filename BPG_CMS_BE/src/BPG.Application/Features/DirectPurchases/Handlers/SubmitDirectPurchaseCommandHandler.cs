using BPG.Application.DTOs.DirectPurchases;
using BPG.Application.Features.DirectPurchases.Commands;
using BPG.Application.Features.DirectPurchases.Services;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Common;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentValidation;
using FluentValidation.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UserRole = BPG.Domain.Constants.UserRole;

namespace BPG.Application.Features.DirectPurchases.Handlers
{
    /// <summary>
    /// Gửi phiếu nháp. Điểm không thể quay lại: validate đầy đủ, tính lại BOQCheckStatus
    /// tại thời điểm gửi, sinh PO + GoodsReceipt và cộng tồn kho.
    /// Mọi phiếu -> Pending: Kế toán soát hóa đơn rồi trình Giám đốc duyệt chi, kể cả phiếu
    /// nằm trong định mức BOQ. BOQCheckStatus chỉ còn là thông tin đối chiếu, không rẽ nhánh luồng.
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

            // Gom hết lỗi của mọi dòng rồi mới ném, kèm vị trí dòng theo dạng "Items[i].Quantity"
            // để FE gắn được dòng đỏ ngay dưới đúng ô nhập. Dừng ở lỗi đầu tiên sẽ bắt người dùng
            // sửa - gửi lại - lại lỗi, mỗi lần một dòng.
            //
            // Sắp theo khóa chính để chỉ số khớp thứ tự FE đã gửi lên: ReplaceItemsAsync xóa sạch
            // rồi thêm lại đúng thứ tự đó, nên Id tăng dần cũng chính là thứ tự các dòng trên form.
            var orderedItems = dp.Items.OrderBy(i => i.DirectPurchaseItemId).ToList();
            var itemFailures = new List<ValidationFailure>();

            for (var index = 0; index < orderedItems.Count; index++)
            {
                var item = orderedItems[index];

                if (item.Quantity <= 0)
                    itemFailures.Add(new ValidationFailure(
                        $"Items[{index}].Quantity", "Số lượng phải lớn hơn 0.")
                    { ErrorCode = ErrorCodes.DpInvalidQuantity });

                if (item.UnitPrice <= 0)
                    itemFailures.Add(new ValidationFailure(
                        $"Items[{index}].UnitPrice", "Đơn giá phải lớn hơn 0.")
                    { ErrorCode = ErrorCodes.DpInvalidUnitPrice });
            }

            if (itemFailures.Count > 0)
                throw new ValidationException(itemFailures);

            // ---------- Hạn mức tiền mua khẩn cấp cộng dồn theo giai đoạn ----------
            // Tính lại từ các dòng thay vì tin vào dp.TotalAmount: cột đó chỉ được ghi lại khi
            // soạn/sửa nháp, còn MaterializeAsync thì cập nhật sau bước này.
            var totalAmount = dp.Items.Sum(i => i.Quantity * i.UnitPrice);

            var phaseMaxConfig = await _uow.Repository<SystemConfig>().Query()
                .FirstOrDefaultAsync(x => x.ConfigKey == SystemConfigKeys.DirectPurchasePhaseMaxAmount, ct);

            // 0, giá trị không đọc được, hoặc thiếu hẳn row = không giới hạn. Cấu hình hỏng không
            // được phép khóa cứng luồng gửi phiếu.
            var phaseMaxAmount = decimal.TryParse(phaseMaxConfig?.ConfigValue,
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var parsedPhaseMax) && parsedPhaseMax > 0
                ? parsedPhaseMax
                : 0m;

            if (phaseMaxAmount > 0)
            {
                // Cộng dồn mọi phiếu đã gửi của giai đoạn, KỂ CẢ phiếu bị Giám đốc từ chối duyệt chi:
                // phiếu từ chối vẫn đã nhập kho và vẫn tiêu thụ định mức BOQ, nên cũng phải tiêu thụ
                // hạn mức tiền. Phiếu nháp chưa tính vì chưa phát sinh gì.
                var spentInPhase = await _uow.Repository<DirectPurchaseRequest>().Query()
                    .Where(r => r.PhaseId == dp.PhaseId &&
                                r.DirectPurchaseId != dp.DirectPurchaseId &&
                                r.Status != DirectPurchaseStatus.Draft &&
                                !r.IsDeleted)
                    .SumAsync(r => r.TotalAmount, ct);

                if (spentInPhase + totalAmount > phaseMaxAmount)
                    throw new BusinessException(ErrorCodes.DpOverPhaseMaxAmount,
                        $"Giai đoạn '{dp.Phase.Name}' chỉ được mua khẩn cấp tối đa {phaseMaxAmount:N0}đ. " +
                        $"Đã dùng {spentInPhase:N0}đ, phiếu này {totalAmount:N0}đ, tổng {spentInPhase + totalAmount:N0}đ — vượt {spentInPhase + totalAmount - phaseMaxAmount:N0}đ. " +
                        "Vui lòng bớt vật tư khỏi phiếu, lập Yêu cầu vật tư theo quy trình thường, hoặc liên hệ Kế toán/Quản trị viên.");
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
            var todayVn = VietnamTime.Today;
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
                // Approved chỉ được gán khi Giám đốc ký duyệt chi, nên Approved luôn đồng nghĩa
                // "sẽ được hoàn tiền".
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
            var boqNote = anyOverBOQ ? " Phiếu vượt định mức BOQ." : string.Empty;
            var content = $"Phiếu mua khẩn cấp DP-{dp.DirectPurchaseId:D6} vừa được gửi cho giai đoạn '{dp.Phase.Name}'. " +
                          $"Tổng giá trị: {dp.TotalAmount:N0}đ. Vật tư đã nhập kho.{boqNote} " +
                          "Vui lòng đối chiếu hóa đơn để trình Giám đốc duyệt chi.";

            await _notificationService.SendNotificationToRoleAsync(
                UserRole.Accountant, title, content,
                NotificationType.Procurement, NotificationLink.ProjectDirectPurchases(dp.ProjectId), dp.DirectPurchaseId, ct);

            return "Gửi phiếu thành công. Tồn kho đã được cập nhật, phiếu đang chờ Kế toán soát hóa đơn để trình Giám đốc duyệt chi.";
        }
    }
}
