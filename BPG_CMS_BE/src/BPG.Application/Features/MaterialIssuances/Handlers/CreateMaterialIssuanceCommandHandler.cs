using BPG.Application.Common.Models;
using BPG.Application.Features.MaterialIssuances.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Common;
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

namespace BPG.Application.Features.MaterialIssuances.Handlers
{
    public class CreateMaterialIssuanceCommandHandler : IRequestHandler<CreateMaterialIssuanceCommand, ApiResponse<long>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IInventoryService _inventoryService;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;

        public CreateMaterialIssuanceCommandHandler(
            IUnitOfWork uow, 
            ICurrentUserService currentUserService,
            IInventoryService inventoryService,
            IRealtimeNotificationSender realtimeSender,
            INotificationService notificationService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _inventoryService = inventoryService;
            _realtimeSender = realtimeSender;
            _notificationService = notificationService;
        }

        public async Task<ApiResponse<long>> Handle(CreateMaterialIssuanceCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            if (request.Items == null || !request.Items.Any())
            {
                throw new BusinessException("ERR_EMPTY_ITEMS", "Danh sách vật tư xuất dùng không được để trống.");
            }

            // 1. Kiểm tra task tồn tại
            var task = await _uow.Repository<ProjectTask>().Query()
                .Include(t => t.Phase)
                    .ThenInclude(p => p.Project)
                .Include(t => t.Assignees)
                .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, cancellationToken);

            if (task == null)
            {
                throw new NotFoundException("Công việc", request.TaskId);
            }

            var project = task.Phase?.Project;
            if (project == null)
            {
                throw new BusinessException("ERR_PROJECT_NOT_FOUND", "Không tìm thấy dự án liên kết với công việc này.");
            }

            var isProjectLeader = await _uow.Repository<ProjectMember>().AnyAsync(
                member => member.ProjectId == project.ProjectId && member.UserId == currentUserId && member.IsLeader,
                cancellationToken);
            if (!isProjectLeader)
            {
                throw new ForbiddenException("Chỉ Trưởng dự án mới được tạo phiếu xuất vật tư.");
            }

            // 2. Kiểm tra trạng thái dự án
            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", "Dự án liên kết phải ở trạng thái đang tiến hành (InProgress).");
            }

            // 3. Kiểm tra xem công việc có bị khóa, hoàn thành, tạm dừng hoặc bị hủy/vô hiệu hóa không
            var taskStatusLower = (task.Status ?? string.Empty).ToLower();
            var isInactiveTask = task.IsLocked
                || task.ProgressPercent >= 100
                || taskStatusLower == "obsolete"
                || taskStatusLower == "completed"
                || taskStatusLower == "approved"
                || taskStatusLower == "done"
                || taskStatusLower == "paused"
                || taskStatusLower == "stopped"
                || taskStatusLower == "cancelled"
                || taskStatusLower == "canceled";

            if (isInactiveTask)
            {
                throw new BusinessException("ERR_TASK_INACTIVE", "Không thể xuất kho cho công việc đã bị dừng, tạm dừng, hoàn thành hoặc đã bị hủy.");
            }

            // 3.5. Kiểm tra điều kiện phụ thuộc (Finish-to-Start): Công việc chưa được phép tiến hành nếu các task tiền nhiệm chưa hoàn thành
            var incompletePredecessors = await _uow.Repository<TaskDependency>()
                .Query()
                .Include(td => td.Predecessor)
                .Where(td => td.TaskId == task.TaskId 
                    && td.Predecessor.ProgressPercent < 100
                    && td.Predecessor.Status != BPG.Domain.Constants.TaskStatus.Obsolete)
                .ToListAsync(cancellationToken);

            if (incompletePredecessors.Any())
            {
                // Tìm tất cả các ancestor IDs để loại trừ khỏi danh sách chặn (nếu task cha phụ thuộc vào task con)
                var ancestorIds = new HashSet<long>();
                long? currentParentId = task.ParentTaskId;
                while (currentParentId.HasValue)
                {
                    ancestorIds.Add(currentParentId.Value);
                    var parent = await _uow.Repository<ProjectTask>()
                        .Query()
                        .Select(t => new { t.TaskId, t.ParentTaskId })
                        .FirstOrDefaultAsync(t => t.TaskId == currentParentId.Value, cancellationToken);
                    currentParentId = parent?.ParentTaskId;
                }

                var blockedPredecessors = incompletePredecessors
                    .Where(td => !ancestorIds.Contains(td.PredecessorTaskId))
                    .ToList();

                if (blockedPredecessors.Any())
                {
                    var predecessorNames = string.Join(", ", blockedPredecessors.Select(p => $"'{p.Predecessor?.Name ?? "ID " + p.PredecessorTaskId}'"));
                    throw new BusinessException("ERR_TASK_DEPENDENCY_INCOMPLETE", 
                        $"Công việc {task.Name} chưa được phép tiến hành do các công việc tiền nhiệm ({predecessorNames}) chưa hoàn thành 100%. Vui lòng hoàn thành các công việc tiền nhiệm trước khi xuất dùng vật tư.");
                }
            }

            // 4. Kiểm tra tồn kho khả dụng của từng vật tư
            var materialIds = request.Items.Select(i => i.MaterialId).ToList();
            var inventoryList = await _uow.Repository<CurrentInventory>().Query()
                .Include(ci => ci.Material)
                    .ThenInclude(m => m.BaseUnit)
                .Where(ci => ci.ProjectId == project.ProjectId && materialIds.Contains(ci.MaterialId))
                .ToListAsync(cancellationToken);

            var inventoryMap = inventoryList.ToDictionary(ci => ci.MaterialId);

            foreach (var item in request.Items)
            {
                if (!inventoryMap.TryGetValue(item.MaterialId, out var inv))
                {
                    throw new BusinessException("ERR_NO_INVENTORY", 
                        $"Vật tư ID {item.MaterialId} không tồn tại trong kho của dự án.");
                }

                if (inv.Material.BaseUnit != null && inv.Material.BaseUnit.IsDiscrete && item.Quantity % 1 != 0)
                {
                    throw new BusinessException(ErrorCodes.InvalidUnitQuantity, 
                        $"Đơn vị tính '{inv.Material.BaseUnit.UnitName}' của vật tư {inv.Material.Name} yêu cầu số lượng xuất phải là số nguyên.");
                }

                // Chuyển đổi số lượng xuất ra đơn vị cơ bản
                decimal conversionRate = item.ConversionRate > 0 ? item.ConversionRate : 1;
                decimal requiredBaseQty = item.Quantity / conversionRate;

                // Tồn kho khả dụng = Số lượng tồn - Số lượng đóng băng
                decimal availableQty = inv.Quantity - inv.ReservedQuantity;

                if (availableQty < requiredBaseQty)
                {
                    string unitName = inv.Material.BaseUnit?.UnitName ?? "đơn vị";
                    throw new BusinessException("ERR_INSUFFICIENT_STOCK", 
                        $"Không đủ tồn kho khả dụng cho vật tư {inv.Material.Name}. Yêu cầu xuất: {requiredBaseQty.ToString("G29")} {unitName}, tồn khả dụng còn lại: {availableQty.ToString("G29")} {unitName}.");
                }
            }

            // 5. Bắt đầu transaction để thực thi xuất kho
            await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                // Sinh mã phiếu xuất kho chuẩn nghiệp vụ, ví dụ: PXu-20240630-A3F8B2
                var vnNow = VietnamTime.Now;
                var issuanceNo = $"PXu-{vnNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

                var issuance = new MaterialIssuance
                {
                    IssuanceNo = issuanceNo,
                    TaskId = request.TaskId,
                    Purpose = request.Purpose,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = currentUserId
                };

                await _uow.Repository<MaterialIssuance>().AddAsync(issuance, cancellationToken);
                await _uow.SaveChangesAsync(cancellationToken); // lấy MaterialIssuanceId

                var issuanceItems = new List<MaterialIssuanceItem>();

                foreach (var item in request.Items)
                {
                    var inv = inventoryMap[item.MaterialId];
                    decimal conversionRate = item.ConversionRate > 0 ? item.ConversionRate : 1;
                    decimal baseQty = item.Quantity / conversionRate;

                    var issuanceItem = new MaterialIssuanceItem
                    {
                        MaterialIssuanceId = issuance.MaterialIssuanceId,
                        MaterialId = item.MaterialId,
                        UnitId = item.UnitId,
                        Quantity = item.Quantity,
                        ConversionRate = conversionRate
                    };
                    issuanceItems.Add(issuanceItem);

                    // Trừ tồn kho và ghi nhận thẻ kho thông qua InventoryService
                    await _inventoryService.UpdateStockAsync(
                        project.ProjectId,
                        item.MaterialId,
                        -baseQty,
                        InventoryTransactionType.Issuance,
                        issuance.MaterialIssuanceId,
                        EntityType.MaterialIssuance,
                        currentUserId,
                        cancellationToken);
                }

                await _uow.Repository<MaterialIssuanceItem>().AddRangeAsync(issuanceItems, cancellationToken);
                await _uow.SaveChangesAsync(cancellationToken);
                await _uow.CommitTransactionAsync(cancellationToken);

                var actorName = await _uow.Repository<User>().Query()
                    .AsNoTracking()
                    .Where(u => u.UserId == currentUserId)
                    .Select(u => u.FullName)
                    .FirstOrDefaultAsync(cancellationToken) ?? "Người dùng";

                var assigneeIds = task.Assignees
                    .Select(a => a.UserId)
                    .Where(userId => userId != currentUserId)
                    .Distinct()
                    .ToList();

                foreach (var assigneeId in assigneeIds)
                {
                    await _notificationService.SendNotificationAsync(
                        assigneeId,
                        "Bạn được xuất vật tư cho công việc",
                        $"{actorName} đã tạo phiếu xuất vật tư {issuance.IssuanceNo} cho công việc {task.Name} tại dự án {project.Name}.",
                        NotificationType.Procurement,
                        $"/projects/{project.ProjectId}?tab=inventory&subTab=issuances&issuanceId={issuance.MaterialIssuanceId}",
                        issuance.MaterialIssuanceId,
                        cancellationToken);
                }

                var technicalManagerIds = await _uow.Repository<User>().Query()
                    .AsNoTracking()
                    .Include(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                    .Where(u => u.IsActive
                        && !u.IsDeleted
                        && u.UserId != currentUserId
                        && !assigneeIds.Contains(u.UserId)
                        && u.UserRoles.Any(ur => ur.Role.RoleName == BPG.Domain.Constants.UserRole.TechnicalManager))
                    .Select(u => u.UserId)
                    .Distinct()
                    .ToListAsync(cancellationToken);

                foreach (var technicalManagerId in technicalManagerIds)
                {
                    await _notificationService.SendNotificationAsync(
                        technicalManagerId,
                        "Phiếu xuất vật tư mới",
                        $"{actorName} đã tạo phiếu xuất vật tư {issuance.IssuanceNo} cho công việc {task.Name} tại dự án {project.Name}.",
                        NotificationType.Procurement,
                        $"/projects/{project.ProjectId}?tab=inventory&subTab=issuances&issuanceId={issuance.MaterialIssuanceId}",
                        issuance.MaterialIssuanceId,
                        cancellationToken);
                }

                // Realtime: broadcast to members viewing this project's inventory workspace
                await _realtimeSender.SendToGroupAsync(
                    HubMethodNames.GroupProject + project.ProjectId,
                    HubMethodNames.MaterialIssuanceChanged,
                    issuance.MaterialIssuanceId,
                    cancellationToken);

                // Realtime: broadcast to members viewing global inventory (Project_0)
                await _realtimeSender.SendToGroupAsync(
                    HubMethodNames.GroupProject + 0,
                    HubMethodNames.MaterialIssuanceChanged,
                    issuance.MaterialIssuanceId,
                    cancellationToken);

                return ApiResponse<long>.SuccessResult(issuance.MaterialIssuanceId, "Tạo phiếu xuất kho thành công.");
            }
            catch (Exception)
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }
        }
    }
}
