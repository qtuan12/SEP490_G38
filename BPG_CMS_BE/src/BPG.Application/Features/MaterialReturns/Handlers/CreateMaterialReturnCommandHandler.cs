using BPG.Application.Common.Models;
using BPG.Application.Features.MaterialReturns.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialReturns.Handlers
{
    public class CreateMaterialReturnCommandHandler : IRequestHandler<CreateMaterialReturnCommand, ApiResponse<long>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IInventoryService _inventoryService;

        public CreateMaterialReturnCommandHandler(
            IUnitOfWork uow,
            ICurrentUserService currentUserService,
            IInventoryService inventoryService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _inventoryService = inventoryService;
        }

        public async Task<ApiResponse<long>> Handle(CreateMaterialReturnCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            if (request.Items == null || !request.Items.Any())
            {
                throw new BusinessException("ERR_EMPTY_ITEMS", "Danh sách vật tư hoàn trả không được để trống.");
            }

            // 1. Load phiếu xuất kho gốc để xác định dự án và task
            var issuance = await _uow.Repository<MaterialIssuance>().Query()
                .Include(i => i.Task)
                    .ThenInclude(t => t.Phase)
                        .ThenInclude(p => p.Project)
                .Include(i => i.Items)
                .FirstOrDefaultAsync(i => i.MaterialIssuanceId == request.OriginalIssuanceId, cancellationToken);

            if (issuance == null)
            {
                throw new NotFoundException(nameof(MaterialIssuance), request.OriginalIssuanceId);
            }

            var project = issuance.Task?.Phase?.Project;
            if (project == null)
            {
                throw new BusinessException("ERR_PROJECT_NOT_FOUND", "Không tìm thấy dự án liên kết với phiếu xuất kho này.");
            }

            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", "Dự án phải ở trạng thái đang tiến hành để hoàn trả vật tư.");
            }

            // 2. Xây dựng map số lượng đã xuất từ phiếu xuất gốc (theo đơn vị cơ bản)
            // Key: MaterialId, Value: tổng base qty đã xuất trong phiếu đó
            var issuedBaseQtyMap = issuance.Items
                .GroupBy(i => i.MaterialId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Sum(i => i.Quantity / (i.ConversionRate > 0 ? i.ConversionRate : 1))
                );

            // 2.1 Lấy toàn bộ danh sách vật tư đã được hoàn trả trước đó cho phiếu xuất này để tính lũy kế
            var previousReturnItems = await _uow.Repository<MaterialReturnItem>().Query()
                .Include(ri => ri.Return)
                .Where(ri => ri.Return.OriginalIssuanceId == request.OriginalIssuanceId && !ri.Return.IsDeleted)
                .ToListAsync(cancellationToken);

            var previousReturnedBaseQtyMap = previousReturnItems
                .GroupBy(ri => ri.MaterialId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Sum(ri => ri.Quantity / (ri.ConversionRate > 0 ? ri.ConversionRate : 1))
                );

            // 3. Validate từng dòng hoàn trả
            foreach (var item in request.Items)
            {
                if (!issuedBaseQtyMap.TryGetValue(item.MaterialId, out var issuedQty))
                {
                    throw new BusinessException("ERR_MATERIAL_NOT_IN_ISSUANCE",
                        $"Vật tư ID {item.MaterialId} không có trong phiếu xuất kho gốc #{issuance.IssuanceNo}. Chỉ được hoàn trả vật tư đã xuất.");
                }

                previousReturnedBaseQtyMap.TryGetValue(item.MaterialId, out var alreadyReturnedQty);

                decimal conversionRate = item.ConversionRate > 0 ? item.ConversionRate : 1;
                decimal returnBaseQty = item.Quantity / conversionRate;

                if (returnBaseQty <= 0)
                {
                    throw new BusinessException("ERR_INVALID_QUANTITY", "Số lượng hoàn trả phải lớn hơn 0.");
                }

                decimal remainingReturnableQty = issuedQty - alreadyReturnedQty;

                if (returnBaseQty > remainingReturnableQty)
                {
                    throw new BusinessException("ERR_RETURN_EXCEEDS_ISSUED",
                        $"Số lượng hoàn trả ({returnBaseQty:N3}) vượt quá giới hạn còn lại có thể trả ({remainingReturnableQty:N3}) cho vật tư ID {item.MaterialId} (Tổng xuất: {issuedQty:N3}, Đã trả trước đó: {alreadyReturnedQty:N3}) trong phiếu xuất #{issuance.IssuanceNo}.");
                }
            }

            // 4. Bắt đầu transaction
            await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                // Sinh mã phiếu hoàn trả chuẩn nghiệp vụ, ví dụ: PTra-20240630-A3F8B2
                var vnNow = DateTime.UtcNow.AddHours(7);
                var returnNo = $"PTra-{vnNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

                var materialReturn = new MaterialReturn
                {
                    ReturnNo = returnNo,
                    OriginalIssuanceId = request.OriginalIssuanceId,
                    Reason = request.Reason,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = currentUserId
                };

                await _uow.Repository<MaterialReturn>().AddAsync(materialReturn, cancellationToken);
                await _uow.SaveChangesAsync(cancellationToken); // lấy MaterialReturnId

                var returnItems = new List<MaterialReturnItem>();

                foreach (var item in request.Items)
                {
                    decimal conversionRate = item.ConversionRate > 0 ? item.ConversionRate : 1;
                    decimal baseQty = item.Quantity / conversionRate;

                    returnItems.Add(new MaterialReturnItem
                    {
                        MaterialReturnId = materialReturn.MaterialReturnId,
                        MaterialId = item.MaterialId,
                        UnitId = item.UnitId,
                        Quantity = item.Quantity,
                        ConversionRate = conversionRate
                    });

                    // Hoàn tồn kho: +baseQty (đảo chiều so với xuất kho)
                    await _inventoryService.UpdateStockAsync(
                        project.ProjectId,
                        item.MaterialId,
                        +baseQty,                               // dương = tăng tồn kho
                        InventoryTransactionType.IssuanceReturn,
                        materialReturn.MaterialReturnId,
                        EntityType.MaterialReturn,
                        currentUserId,
                        cancellationToken);
                }

                await _uow.Repository<MaterialReturnItem>().AddRangeAsync(returnItems, cancellationToken);
                await _uow.SaveChangesAsync(cancellationToken);
                await _uow.CommitTransactionAsync(cancellationToken);

                return ApiResponse<long>.SuccessResult(materialReturn.MaterialReturnId, $"Tạo phiếu hoàn trả {returnNo} thành công. Tồn kho đã được cập nhật.");
            }
            catch (Exception)
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }
        }
    }
}
