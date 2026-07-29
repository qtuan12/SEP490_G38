using MediatR;
using BPG.Application.Common.Models;
using BPG.Application.Features.MaterialRequests.Commands;
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

namespace BPG.Application.Features.MaterialRequests.Handlers
{
    public class CreateMaterialRequestCommandHandler : IRequestHandler<CreateMaterialRequestCommand, ApiResponse<long>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly INotificationService _notificationService;

        public CreateMaterialRequestCommandHandler(
            IUnitOfWork uow, 
            ICurrentUserService currentUserService,
            INotificationService notificationService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _notificationService = notificationService;
        }

        public async Task<ApiResponse<long>> Handle(CreateMaterialRequestCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            if (request.Type == "emergency")
            {
                throw new BusinessException("ERR_EMERGENCY_REQUEST_NOT_SUPPORTED", 
                    "Hệ thống không hỗ trợ lập phiếu mua ngoài khẩn cấp qua luồng yêu cầu này. Vui lòng sử dụng chức năng Mua sắm khẩn cấp riêng biệt.");
            }

            // 1. Kiểm tra dự án tồn tại và hoạt động
            var project = await _uow.Repository<Project>().Query()
                .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, cancellationToken);
            if (project == null)
            {
                throw new NotFoundException(nameof(Project), request.ProjectId);
            }
            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", "Dự án hiện không ở trạng thái hoạt động (InProgress).");
            }

            // 2. Kiểm tra Phase tồn tại và thuộc dự án
            var phase = await _uow.Repository<Phase>().Query()
                .FirstOrDefaultAsync(p => p.PhaseId == request.PhaseId, cancellationToken);
            if (phase == null)
            {
                throw new NotFoundException(nameof(Phase), request.PhaseId);
            }
            if (phase.ProjectId != request.ProjectId)
            {
                throw new BusinessException("ERR_PHASE_PROJECT_MISMATCH", "Giai đoạn không thuộc dự án đã chọn.");
            }
            if (phase.Status == PhaseStatus.Approved)
            {
                throw new BusinessException("ERR_PHASE_FROZEN", "Giai đoạn đã được nghiệm thu và đóng băng (Approved), không thể yêu cầu vật tư mới.");
            }

            bool anyItemOverBOQ = false;
            var requestItems = new List<MaterialRequestItem>();

            // 3. Xử lý và kiểm tra từng vật tư yêu cầu
            foreach (var item in request.Items)
            {
                // Tìm kiếm vật tư theo Tên trong Catalog
                var materialNameTrim = item.Name.Trim();
                var material = await _uow.Repository<MaterialCatalog>().Query()
                    .FirstOrDefaultAsync(m => m.Name == materialNameTrim, cancellationToken);
                if (material == null)
                {
                    throw new NotFoundException(nameof(MaterialCatalog), item.Name);
                }

                // Tìm kiếm đơn vị tính tương ứng theo Tên
                var unitNameTrim = item.Unit.Trim();
                var unit = await _uow.Repository<BPG.Domain.Entities.Unit>().Query()
                    .FirstOrDefaultAsync(u => u.UnitName == unitNameTrim, cancellationToken);
                if (unit == null)
                {
                    throw new NotFoundException(nameof(BPG.Domain.Entities.Unit), item.Unit);
                }

                if (unit.IsDiscrete && item.Quantity % 1 != 0)
                {
                    throw new BusinessException(ErrorCodes.InvalidUnitQuantity, 
                        $"Đơn vị tính '{unit.UnitName}' yêu cầu số lượng phải là số nguyên.");
                }

                // Xác định tỷ lệ quy đổi sang đơn vị cơ bản (Base Unit)
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

                // Quy đổi số lượng yêu cầu đợt này sang Base Unit
                decimal qtyInBase = item.Quantity / (conversionRate == 0 ? 1m : conversionRate);

                // Lấy định mức BOQ được duyệt của vật tư trong Phase này
                var boq = await _uow.Repository<BOQItem>().Query()
                    .FirstOrDefaultAsync(b => b.PhaseId == request.PhaseId && b.MaterialId == material.MaterialId && !b.IsDeleted, cancellationToken);

                decimal boqLimitInBase = 0m;
                bool isOverBOQ = false;

                if (boq == null)
                {
                    // Nếu vật tư không có trong định mức BOQ -> Mặc định vượt BOQ
                    isOverBOQ = true;
                    anyItemOverBOQ = true;
                }
                else
                {
                    boqLimitInBase = boq.Quantity / (boq.ConversionRate == 0 ? 1m : boq.ConversionRate);

                    // Tính lũy kế số lượng đã yêu cầu của các phiếu đang xử lý/đã duyệt trước đó
                    var totalRequestedBeforeInBase = await _uow.Repository<MaterialRequestItem>().Query()
                        .Where(ri => ri.Request.PhaseId == request.PhaseId && 
                                     ri.MaterialId == material.MaterialId &&
                                     ri.Request.Status != MaterialRequestStatus.Rejected &&
                                     ri.Request.Status != MaterialRequestStatus.Cancelled &&
                                     !ri.Request.IsDeleted)
                        .SumAsync(ri => ri.Quantity / (ri.ConversionRate == 0 ? 1m : ri.ConversionRate), cancellationToken);

                    // So sánh tổng yêu cầu (trước đó + đợt này) với định mức BOQ
                    if (totalRequestedBeforeInBase + qtyInBase > boqLimitInBase)
                    {
                        isOverBOQ = true;
                        anyItemOverBOQ = true;
                    }
                }

                requestItems.Add(new MaterialRequestItem
                {
                    MaterialId = material.MaterialId,
                    UnitId = unit.UnitId,
                    Quantity = item.Quantity,
                    ConversionRate = conversionRate,
                    IsOverBOQ = isOverBOQ,
                    Explanation = isOverBOQ ? "Yêu cầu vượt quá hạn mức định mức BOQ của Phase." : null
                });
            }

            // 4. Kiểm tra lý do giải trình nếu vượt BOQ
            string boqCheckStatus = BOQCheckStatus.WithinBOQ;
            if (anyItemOverBOQ)
            {
                boqCheckStatus = BOQCheckStatus.OverBOQ;
            }

            // 5. Tạo bản ghi MaterialRequest
            var materialRequest = new MaterialRequest
            {
                PhaseId = request.PhaseId,
                BOQCheckStatus = boqCheckStatus,
                Reason = request.Reason,
                Status = MaterialRequestStatus.Pending,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = currentUserId
            };

            await _uow.Repository<MaterialRequest>().AddAsync(materialRequest, cancellationToken);
            await _uow.SaveChangesAsync(cancellationToken); // Phát sinh RequestId

            foreach (var ri in requestItems)
            {
                ri.RequestId = materialRequest.RequestId;
            }

            await _uow.Repository<MaterialRequestItem>().AddRangeAsync(requestItems, cancellationToken);
            await _uow.SaveChangesAsync(cancellationToken);

            // Gửi thông báo đến vai trò Kế toán
            try
            {
                var user = await _uow.Repository<User>().GetByIdAsync(currentUserId, cancellationToken);
                var userName = user?.FullName ?? "Trưởng dự án";

                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.Accountant,
                    "Yêu cầu vật tư mới",
                    $"{userName} vừa tạo yêu cầu vật tư mới cho giai đoạn '{phase.Name}' thuộc dự án '{project.Name}'.",
                    NotificationType.Procurement,
                    $"/projects/{project.ProjectId}/workspace/materialrequests",
                    materialRequest.RequestId,
                    cancellationToken);
            }
            catch (Exception ex)
            {
                // Log and continue, do not block the request transaction
                Console.WriteLine($"Error sending notification: {ex.Message}");
            }

            return ApiResponse<long>.SuccessResult(materialRequest.RequestId, "Gửi yêu cầu vật tư thành công.");
        }
    }
}
