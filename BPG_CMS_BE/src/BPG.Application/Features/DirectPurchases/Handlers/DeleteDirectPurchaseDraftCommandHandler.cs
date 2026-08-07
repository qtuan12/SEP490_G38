using BPG.Application.Features.DirectPurchases.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

using BPG.Application.Features.DirectPurchases.Services;
namespace BPG.Application.Features.DirectPurchases.Handlers
{
    public class DeleteDirectPurchaseDraftCommandHandler : IRequestHandler<DeleteDirectPurchaseDraftCommand, bool>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IFileStorageService _fileStorage;

        public DeleteDirectPurchaseDraftCommandHandler(
            IUnitOfWork uow,
            ICurrentUserService currentUserService,
            IFileStorageService fileStorage)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _fileStorage = fileStorage;
        }

        public async Task<bool> Handle(DeleteDirectPurchaseDraftCommand request, CancellationToken ct)
        {
            long userId = _currentUserService.GetRequiredUserId();

            var dp = await _uow.Repository<DirectPurchaseRequest>().Query()
                .FirstOrDefaultAsync(r => r.DirectPurchaseId == request.DirectPurchaseId && !r.IsDeleted, ct)
                ?? throw new NotFoundException("Không tìm thấy phiếu mua trực tiếp cần xóa.");

            if (dp.Status != DirectPurchaseStatus.Draft)
                throw new BusinessException(ErrorCodes.DpNotDraft,
                    $"Chỉ xóa được phiếu ở trạng thái Nháp. Trạng thái hiện tại: {DirectPurchaseStatus.Label(dp.Status)}.");

            if (dp.RequestedBy != userId)
                throw new ForbiddenException("Chỉ người tạo mới được xóa phiếu nháp này.");

            await DirectPurchaseGuard.EnsureCanManageAsync(_uow, _currentUserService, dp.ProjectId, userId, ct);

            // CỐ Ý không kiểm trạng thái dự án ở đây (khác với tạo/sửa nháp): xóa là thao tác dọn
            // dẹp, chặn nó khi dự án tạm dừng chỉ làm phiếu nháp kẹt lại vĩnh viễn chứ không bảo
            // vệ được gì — phiếu nháp không sinh chứng từ, không đụng tồn kho, không đụng tiền.

            dp.IsDeleted = true;
            dp.UpdatedAt = DateTime.UtcNow;
            dp.UpdatedBy = userId;

            _uow.Repository<DirectPurchaseRequest>().Update(dp);

            // Ảnh hóa đơn chỉ thuộc về phiếu này. Bỏ sót thì bản ghi rác tích tụ, và tệ hơn là
            // ảnh vẫn tải được trên storage với ai biết URL dù phiếu đã bị xóa.
            var invoicePhotos = await _uow.Repository<Attachment>().Query()
                .Where(a => a.EntityType == EntityType.DirectPurchaseRequest
                         && a.EntityId == dp.DirectPurchaseId
                         && a.AttachmentType == AttachmentType.InvoicePhoto
                         && !a.IsDeleted)
                .ToListAsync(ct);

            foreach (var photo in invoicePhotos)
            {
                photo.IsDeleted = true;
                photo.UpdatedAt = DateTime.UtcNow;
                photo.UpdatedBy = userId;
                _uow.Repository<Attachment>().Update(photo);
            }

            await _uow.SaveChangesAsync(ct);

            // Xóa file trên storage sau khi DB đã commit, và không để lỗi storage làm hỏng thao tác
            // xóa phiếu: bản ghi đã đánh dấu xóa nên cùng lắm là còn file mồ côi trên Cloudinary.
            foreach (var photo in invoicePhotos)
            {
                try
                {
                    await _fileStorage.DeleteFileAsync(photo.FileUrl, ct);
                }
                catch
                {
                    // Bỏ qua có chủ đích — xem ghi chú ở trên.
                }
            }

            return true;
        }
    }
}
