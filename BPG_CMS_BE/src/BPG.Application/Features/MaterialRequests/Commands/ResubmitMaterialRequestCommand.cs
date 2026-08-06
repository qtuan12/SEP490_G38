using MediatR;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialRequests.Commands
{
    public record ResubmitMaterialRequestCommand(
        long RequestId,
        string Reason,
        List<MaterialRequestItemInput> Items
    ) : IRequest<ApiResponse<bool>>
    {
    }

    public class ResubmitMaterialRequestCommandHandler : IRequestHandler<ResubmitMaterialRequestCommand, ApiResponse<bool>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly INotificationService _notificationService;

        public ResubmitMaterialRequestCommandHandler(
            IUnitOfWork uow, 
            ICurrentUserService currentUserService,
            INotificationService notificationService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _notificationService = notificationService;
        }

        public async Task<ApiResponse<bool>> Handle(ResubmitMaterialRequestCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            if (request.Items == null || !request.Items.Any())
            {
                throw new BusinessException("ERR_ITEMS_REQUIRED", "Phải có ít nhất 1 vật tư trong đề xuất.");
            }

            var mr = await _uow.Repository<MaterialRequest>().Query()
                .Include(x => x.Phase)
                .Include(x => x.Items)
                .FirstOrDefaultAsync(x => x.RequestId == request.RequestId, cancellationToken);

            if (mr == null)
            {
                throw new NotFoundException(nameof(MaterialRequest), request.RequestId);
            }

            if (mr.CreatedBy != currentUserId)
            {
                throw new ForbiddenException("Bạn không có quyền gửi lại yêu cầu vật tư này.");
            }

            // Chỉ cho phép gửi lại khi đang ở trạng thái Rejected
            if (mr.Status != MaterialRequestStatus.Rejected)
            {
                throw new BusinessException("ERR_INVALID_STATUS_FOR_RESUBMIT",
                    $"Chỉ có thể gửi lại yêu cầu đang ở trạng thái Từ chối (Rejected). Trạng thái hiện tại: {mr.Status}.");
            }

            // Kiểm tra phase chưa bị đóng băng
            if (mr.Phase.Status == PhaseStatus.Approved)
            {
                throw new BusinessException("ERR_PHASE_FROZEN", "Giai đoạn đã được nghiệm thu và đóng băng, không thể gửi lại yêu cầu vật tư.");
            }

            // Xử lý danh sách vật tư mới
            bool anyItemOverBOQ = false;
            var newItems = new List<MaterialRequestItem>();

            foreach (var item in request.Items)
            {
                var materialNameTrim = item.Name.Trim();
                var material = await _uow.Repository<MaterialCatalog>().Query()
                    .FirstOrDefaultAsync(m => m.Name == materialNameTrim, cancellationToken);
                if (material == null)
                {
                    throw new NotFoundException(nameof(MaterialCatalog), item.Name);
                }

                var unitNameTrim = item.Unit.Trim();
                var unit = await _uow.Repository<BPG.Domain.Entities.Unit>().Query()
                    .FirstOrDefaultAsync(u => u.UnitName == unitNameTrim, cancellationToken);
                if (unit == null)
                {
                    throw new NotFoundException(nameof(BPG.Domain.Entities.Unit), item.Unit);
                }

                decimal conversionRate = 1.0m;
                if (material.BaseUnitId != unit.UnitId)
                {
                    var conversion = await _uow.Repository<MaterialConversion>().Query()
                        .FirstOrDefaultAsync(c => c.MaterialId == material.MaterialId && c.AlternativeUnitId == unit.UnitId, cancellationToken);
                    if (conversion == null)
                    {
                        throw new BusinessException("ERR_INVALID_UNIT",
                            $"Đơn vị tính '{item.Unit}' không được hỗ trợ cho vật tư '{material.Name}'.");
                    }
                    conversionRate = conversion.ConversionRate;
                }

                decimal qtyInBase = item.Quantity / (conversionRate == 0 ? 1m : conversionRate);

                var boq = await _uow.Repository<BOQItem>().Query()
                    .FirstOrDefaultAsync(b => b.PhaseId == mr.Phase.PhaseId && b.MaterialId == material.MaterialId && !b.IsDeleted, cancellationToken);

                bool isOverBOQ = false;
                if (boq == null)
                {
                    isOverBOQ = true;
                    anyItemOverBOQ = true;
                }
                else
                {
                    decimal boqLimitInBase = boq.Quantity / (boq.ConversionRate == 0 ? 1m : boq.ConversionRate);

                    // Tính lũy kế số lượng đã yêu cầu ở các phiếu KHÁC (không tính phiếu đang resubmit này)
                    var totalRequestedBeforeInBase = await _uow.Repository<MaterialRequestItem>().Query()
                        .Where(ri => ri.Request.PhaseId == mr.Phase.PhaseId &&
                                     ri.MaterialId == material.MaterialId &&
                                     ri.RequestId != mr.RequestId &&
                                     ri.Request.Status != MaterialRequestStatus.Rejected &&
                                     ri.Request.Status != MaterialRequestStatus.Cancelled &&
                                     !ri.Request.IsDeleted)
                        .SumAsync(ri => ri.Quantity / (ri.ConversionRate == 0 ? 1m : ri.ConversionRate), cancellationToken);

                    if (totalRequestedBeforeInBase + qtyInBase > boqLimitInBase)
                    {
                        isOverBOQ = true;
                        anyItemOverBOQ = true;
                    }
                }

                newItems.Add(new MaterialRequestItem
                {
                    RequestId = mr.RequestId,
                    MaterialId = material.MaterialId,
                    UnitId = unit.UnitId,
                    Quantity = item.Quantity,
                    ConversionRate = conversionRate,
                    IsOverBOQ = isOverBOQ,
                    Explanation = isOverBOQ ? "Yêu cầu vượt quá hạn mức định mức BOQ của Phase." : null
                });
            }

            // Xóa các item cũ
            var oldItems = mr.Items.ToList();
            _uow.Repository<MaterialRequestItem>().RemoveRange(oldItems);

            // Cập nhật phiếu: reset về Pending để bắt đầu lại quy trình duyệt
            mr.Status = MaterialRequestStatus.Pending;
            mr.BOQCheckStatus = anyItemOverBOQ ? BOQCheckStatus.OverBOQ : BOQCheckStatus.WithinBOQ;
            mr.Reason = request.Reason.Trim();
            mr.CheckedBy = null;
            mr.ApprovedBy = null;
            mr.AccountantNote = null;
            mr.ApprovalNote = null;
            mr.UpdatedAt = DateTime.UtcNow;
            mr.UpdatedBy = currentUserId;

            _uow.Repository<MaterialRequest>().Update(mr);
            await _uow.SaveChangesAsync(cancellationToken);

            // Thêm các item mới
            foreach (var newItem in newItems)
            {
                newItem.RequestId = mr.RequestId;
            }
            await _uow.Repository<MaterialRequestItem>().AddRangeAsync(newItems, cancellationToken);
            await _uow.SaveChangesAsync(cancellationToken);

            await BPG.Application.Common.Helpers.BOQStatusReevaluator.ReevaluateSiblingRequestsAsync(_uow, mr.PhaseId, mr.RequestId, cancellationToken);
            await _uow.SaveChangesAsync(cancellationToken);

            // Gửi thông báo đến vai trò Kế toán
            try
            {
                var user = await _uow.Repository<User>().GetByIdAsync(currentUserId, cancellationToken);
                var userName = user?.FullName ?? "Trưởng dự án";
                var project = await _uow.Repository<Project>().GetByIdAsync(mr.Phase.ProjectId, cancellationToken);

                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.Accountant,
                    "Yêu cầu vật tư được gửi lại",
                    $"{userName} vừa gửi lại yêu cầu vật tư cho giai đoạn '{mr.Phase.Name}' thuộc dự án '{project?.Name}'.",
                    NotificationType.Procurement,
                    $"/projects/{mr.Phase.ProjectId}/workspace/materialrequests",
                    mr.RequestId,
                    cancellationToken);
            }
            catch (Exception)
            {
                // Bỏ qua lỗi gửi thông báo để không block luồng xử lý chính
            }

            return ApiResponse<bool>.SuccessResult(true, "Đã gửi lại yêu cầu vật tư thành công. Phiếu đang chờ Kế toán xem xét.");
        }
    }
}
