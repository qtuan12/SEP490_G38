using BPG.Application.Common.Models;
using BPG.Application.Features.MaterialReturns.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Common;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;
        private readonly ILogger<CreateMaterialReturnCommandHandler>? _logger;

        public CreateMaterialReturnCommandHandler(
            IUnitOfWork uow,
            ICurrentUserService currentUserService,
            IInventoryService inventoryService,
            IRealtimeNotificationSender realtimeSender,
            INotificationService notificationService,
            ILogger<CreateMaterialReturnCommandHandler>? logger = null)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _inventoryService = inventoryService;
            _realtimeSender = realtimeSender;
            _notificationService = notificationService;
            _logger = logger;
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
                .Include(i => i.Task)
                    .ThenInclude(t => t.Assignees)
                .Include(i => i.Items)
                    .ThenInclude(item => item.Unit)
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

            var isProjectLeader = await _uow.Repository<ProjectMember>().AnyAsync(
                member => member.ProjectId == project.ProjectId && member.UserId == currentUserId && member.IsLeader,
                cancellationToken);
            if (!isProjectLeader)
                throw new ForbiddenException("Chỉ Trưởng dự án mới được tạo phiếu hoàn trả vật tư.");

            var taskName = issuance.Task?.Name ?? "công việc liên quan";

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
            await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                var lockResource = $"MaterialReturn_Issuance_{request.OriginalIssuanceId}";
                await _uow.ExecuteSqlAsync(
                    $"EXEC sp_getapplock @Resource = {lockResource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction'",
                    cancellationToken);

            var previousReturnItems = await _uow.Repository<MaterialReturnItem>().Query()
                .AsNoTracking()
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
            var resolvedItems = new Dictionary<long, (int UnitId, decimal ConversionRate)>();

            foreach (var item in request.Items)
            {
                if (!issuedBaseQtyMap.TryGetValue(item.MaterialId, out var issuedQty))
                {
                    throw new BusinessException("ERR_MATERIAL_NOT_IN_ISSUANCE",
                        $"Vật tư ID {item.MaterialId} không có trong phiếu xuất kho gốc #{issuance.IssuanceNo}. Chỉ được hoàn trả vật tư đã xuất.");
                }

                previousReturnedBaseQtyMap.TryGetValue(item.MaterialId, out var alreadyReturnedQty);

                var originalItem = issuance.Items.FirstOrDefault(issuedItem =>
                    issuedItem.MaterialId == item.MaterialId && issuedItem.UnitId == item.UnitId);
                if (originalItem == null || originalItem.ConversionRate <= 0)
                {
                    throw new BusinessException("ERR_INVALID_RETURN_UNIT",
                        $"Unit ID {item.UnitId} does not match the unit recorded on the original issuance for material ID {item.MaterialId}.");
                }

                if (originalItem.Unit?.IsDiscrete == true && item.Quantity % 1 != 0)
                {
                    throw new BusinessException(
                        ErrorCodes.InvalidUnitQuantity,
                        $"Đơn vị tính '{originalItem.Unit.UnitName}' yêu cầu số lượng hoàn trả phải là số nguyên.");
                }

                decimal conversionRate = originalItem.ConversionRate;
                decimal returnBaseQty = item.Quantity / conversionRate;

                if (returnBaseQty <= 0)
                {
                    throw new BusinessException("ERR_INVALID_QUANTITY", "Số lượng hoàn trả phải lớn hơn 0.");
                }

                decimal remainingReturnableQty = issuedQty - alreadyReturnedQty;

                if (returnBaseQty > remainingReturnableQty)
                {
                    throw new BusinessException("ERR_RETURN_EXCEEDS_ISSUED",
                        $"Số lượng hoàn trả ({returnBaseQty.ToString("G29")}) vượt quá giới hạn còn lại có thể trả ({remainingReturnableQty.ToString("G29")}) cho vật tư ID {item.MaterialId} (Tổng xuất: {issuedQty.ToString("G29")}, Đã trả trước đó: {alreadyReturnedQty.ToString("G29")}) trong phiếu xuất #{issuance.IssuanceNo}.");
                }

                resolvedItems[item.MaterialId] = (originalItem.UnitId, conversionRate);
            }

                // Sinh mã phiếu trả hàng, ví dụ: MR-20240624-A3F8B2
                var vnNow = VietnamTime.Now;
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
                    var resolvedItem = resolvedItems[item.MaterialId];
                    decimal conversionRate = resolvedItem.ConversionRate;
                    decimal baseQty = item.Quantity / conversionRate;

                    returnItems.Add(new MaterialReturnItem
                    {
                        MaterialReturnId = materialReturn.MaterialReturnId,
                        MaterialId = item.MaterialId,
                        UnitId = resolvedItem.UnitId,
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

                try
                {
                var actorName = await _uow.Repository<User>().Query()
                    .AsNoTracking()
                    .Where(u => u.UserId == currentUserId)
                    .Select(u => u.FullName)
                    .FirstOrDefaultAsync(cancellationToken) ?? "Người dùng";

                var assigneeIds = issuance.Task?.Assignees
                    .Select(a => a.UserId)
                    .Where(userId => userId != currentUserId && userId != issuance.CreatedBy)
                    .Distinct()
                    .ToList() ?? new List<long>();

                foreach (var assigneeId in assigneeIds)
                {
                    await _notificationService.SendNotificationAsync(
                        assigneeId,
                        "Vật tư đã được hoàn trả",
                        $"{actorName} đã tạo phiếu hoàn trả vật tư {materialReturn.ReturnNo} từ phiếu xuất {issuance.IssuanceNo} cho công việc {taskName}.",
                        NotificationType.Procurement,
                        $"/projects/{project.ProjectId}?tab=inventory&subTab=issuances&issuanceId={issuance.MaterialIssuanceId}",
                        materialReturn.MaterialReturnId,
                        cancellationToken);
                }

                if (issuance.CreatedBy.HasValue && issuance.CreatedBy.Value != currentUserId)
                {
                    await _notificationService.SendNotificationAsync(
                        issuance.CreatedBy.Value,
                        "Có phiếu hoàn trả vật tư",
                        $"{actorName} đã tạo phiếu hoàn trả vật tư {materialReturn.ReturnNo} từ phiếu xuất {issuance.IssuanceNo} cho công việc {taskName}.",
                        NotificationType.Procurement,
                        $"/projects/{project.ProjectId}?tab=inventory&subTab=issuances&issuanceId={issuance.MaterialIssuanceId}",
                        materialReturn.MaterialReturnId,
                        cancellationToken);
                }

                // Realtime: broadcast to members viewing this project's inventory workspace
                await _realtimeSender.SendToGroupAsync(
                    HubMethodNames.GroupProject + project.ProjectId,
                    HubMethodNames.MaterialReturnChanged,
                    materialReturn.MaterialReturnId,
                    cancellationToken);

                // Realtime: broadcast to members viewing global inventory (Project_0)
                await _realtimeSender.SendToGroupAsync(
                    HubMethodNames.GroupProject + 0,
                    HubMethodNames.MaterialReturnChanged,
                    materialReturn.MaterialReturnId,
                    cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex,
                        "Material return {ReturnId} was committed, but post-commit notification/realtime failed for project {ProjectId}.",
                        materialReturn.MaterialReturnId,
                        project.ProjectId);
                }

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
