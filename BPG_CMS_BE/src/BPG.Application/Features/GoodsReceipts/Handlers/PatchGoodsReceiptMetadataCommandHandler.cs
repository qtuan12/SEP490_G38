using BPG.Application.Common.Models;
using BPG.Application.Features.GoodsReceipts.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.GoodsReceipts.Handlers
{
    public class PatchGoodsReceiptMetadataCommandHandler : IRequestHandler<PatchGoodsReceiptMetadataCommand, ApiResponse<bool>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;

        public PatchGoodsReceiptMetadataCommandHandler(IUnitOfWork uow, ICurrentUserService currentUserService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
        }

        public async Task<ApiResponse<bool>> Handle(PatchGoodsReceiptMetadataCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            // 1. Tìm phiếu nhập kho
            var receipt = await _uow.Repository<GoodsReceipt>().Query()
                .Include(gr => gr.PurchaseOrder)
                    .ThenInclude(p => p!.Request)
                        .ThenInclude(r => r!.Phase)
                            .ThenInclude(ph => ph!.Project)
                .FirstOrDefaultAsync(gr => gr.ReceiptId == request.ReceiptId, cancellationToken);

            if (receipt == null)
            {
                throw new NotFoundException(nameof(GoodsReceipt), request.ReceiptId);
            }

            var project = receipt.PurchaseOrder?.Request?.Phase?.Project;
            if (project == null)
            {
                throw new BusinessException("ERR_PROJECT_NOT_FOUND", "Không tìm thấy dự án liên kết với phiếu nhập kho này.");
            }

            // 2. Kiểm tra quyền: Chỉ Kế toán, Trưởng phòng kỹ thuật, Giám đốc hoặc Trưởng dự án mới có quyền sửa metadata
            bool isOfficeRole = _currentUserService.IsInAnyRole(
                BPG.Domain.Constants.UserRole.Accountant,
                BPG.Domain.Constants.UserRole.TechnicalManager,
                BPG.Domain.Constants.UserRole.Director);

            if (!isOfficeRole)
            {
                var isLeader = await _uow.Repository<ProjectMember>().Query()
                    .AnyAsync(m => m.ProjectId == project.ProjectId && m.UserId == currentUserId && m.IsLeader, cancellationToken);

                if (!isLeader)
                {
                    throw new ForbiddenException("Chỉ Kế toán, Quản lý Kỹ thuật, Giám đốc hoặc Trưởng dự án mới có quyền chỉnh sửa thông tin chứng từ.");
                }
            }

            // 3. Kiểm tra trạng thái dự án
            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", "Dự án liên kết không còn hoạt động, không thể chỉnh sửa thông tin.");
            }

            // 3. Thực hiện cập nhật trong Transaction
            await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                receipt.DelivererInfo = request.DelivererInfo;
                receipt.DeliveryDocNo = request.DeliveryDocNo;
                receipt.UpdatedAt = DateTime.UtcNow;
                receipt.UpdatedBy = currentUserId;

                _uow.Repository<GoodsReceipt>().Update(receipt);

                // Cập nhật ảnh đính kèm (Xóa ảnh cũ và thêm ảnh mới)
                var oldAttachments = await _uow.Repository<Attachment>().Query()
                    .Where(a => a.EntityType == EntityType.GoodsReceipt && a.EntityId == receipt.ReceiptId)
                    .ToListAsync(cancellationToken);

                foreach (var att in oldAttachments)
                {
                    _uow.Repository<Attachment>().Remove(att);
                }

                if (request.Images != null && request.Images.Any())
                {
                    var attachments = request.Images.Select(url => new Attachment
                    {
                        EntityType = EntityType.GoodsReceipt,
                        EntityId = receipt.ReceiptId,
                        AttachmentType = AttachmentType.DeliveryPhoto,
                        FileName = Path.GetFileName(url) ?? "delivery_photo_updated.jpg",
                        FileUrl = url,
                        ContentType = "image/jpeg",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUserId,
                        IsDeleted = false
                    }).ToList();

                    await _uow.Repository<Attachment>().AddRangeAsync(attachments, cancellationToken);
                }

                await _uow.SaveChangesAsync(cancellationToken);
                await _uow.CommitTransactionAsync(cancellationToken);

                return ApiResponse<bool>.SuccessResult(true, "Cập nhật thông tin phiếu nhập kho thành công.");
            }
            catch (Exception)
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }
        }
    }
}
