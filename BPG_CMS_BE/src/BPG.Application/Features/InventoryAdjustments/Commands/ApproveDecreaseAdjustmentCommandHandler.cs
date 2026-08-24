using BPG.Domain.Exceptions;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Models;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.InventoryAdjustments.Commands
{
    public class ApproveDecreaseAdjustmentCommandHandler : IRequestHandler<ApproveDecreaseAdjustmentCommand, ApiResponse<bool>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ICurrentUserService _currentUserService;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;

        public ApproveDecreaseAdjustmentCommandHandler(IUnitOfWork unitOfWork, ICurrentUserService currentUserService, IRealtimeNotificationSender realtimeSender, INotificationService notificationService)
        {
            _unitOfWork = unitOfWork;
            _currentUserService = currentUserService;
            _realtimeSender = realtimeSender;
            _notificationService = notificationService;
        }

        public async Task<ApiResponse<bool>> Handle(ApproveDecreaseAdjustmentCommand request, CancellationToken cancellationToken)
        {
            var adjustment = await _unitOfWork.Repository<InventoryAdjustment>().Query()
                .Include(a => a.Items).ThenInclude(i => i.Material)
                .FirstOrDefaultAsync(a => a.AdjustmentId == request.AdjustmentId, cancellationToken);

            if (adjustment == null) throw new NotFoundException(nameof(InventoryAdjustment), request.AdjustmentId);

            if (adjustment.ProjectId != request.ProjectId)
            {
                throw new BusinessException(
                    "ERR_ADJUSTMENT_PROJECT_MISMATCH",
                    "Phiếu điều chỉnh không thuộc dự án trong đường dẫn.");
            }

            var project = await _unitOfWork.Repository<Project>().GetByIdAsync(adjustment.ProjectId);
            if (project == null) throw new NotFoundException(nameof(Project), adjustment.ProjectId);

            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", "Dự án đang tạm dừng, đã đóng hoặc chưa bắt đầu, không thể thực hiện thao tác này.");
            }

            if (adjustment.Status != InventoryAdjustmentStatus.Pending)
                throw new BusinessException("ERR_INVALID_STATUS", "Phiếu không ở trạng thái chờ duyệt");

            bool isIncrease = adjustment.AdjustmentType == InventoryAdjustmentType.Increase;

            if (isIncrease)
            {
                if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager))
                    throw new ForbiddenException("Chỉ Trưởng phòng kỹ thuật mới được duyệt phiếu tăng tồn.");
            }
            else
            {
                if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.Director))
                    throw new ForbiddenException("Chỉ Giám đốc mới được duyệt phiếu giảm tồn.");
            }

            Incident? linkedIncident = null;
            if (!isIncrease && adjustment.IncidentId.HasValue)
            {
                linkedIncident = await _unitOfWork.Repository<Incident>()
                    .GetByIdAsync(adjustment.IncidentId.Value, cancellationToken);
                if (linkedIncident == null)
                {
                    throw new BusinessException(
                        "ERR_INVALID_INCIDENT",
                        "Không tìm thấy sự cố đã liên kết với phiếu giảm tồn.");
                }

                if (linkedIncident.ProjectId != adjustment.ProjectId
                    || linkedIncident.PhaseId != adjustment.PhaseId
                    || (linkedIncident.IncidentType != "InventoryLoss"
                        && linkedIncident.IncidentType != "InventoryDamage"))
                {
                    throw new BusinessException(
                        "ERR_INVALID_INCIDENT",
                        "Sự cố liên kết không khớp với phiếu giảm tồn.");
                }

                if (linkedIncident.Status != "WaitingDirector")
                {
                    throw new BusinessException(
                        "ERR_INVALID_INCIDENT_STATUS",
                        "Sự cố liên kết không ở trạng thái chờ Giám đốc duyệt.");
                }
            }

            if (!request.IsApproved)
            {
                adjustment.Status = InventoryAdjustmentStatus.Rejected;
                adjustment.RejectedReason = request.RejectedReason;
                adjustment.ApprovedBy = _currentUserService.GetRequiredUserId();
                adjustment.ApprovedAt = System.DateTime.UtcNow;

                _unitOfWork.Repository<InventoryAdjustment>().Update(adjustment);

                if (!isIncrease)
                {
                    foreach (var item in adjustment.Items)
                    {
                        var baseQuantity = GetBaseQuantity(item);
                        var currentInventory = await _unitOfWork.Repository<CurrentInventory>()
                            .FirstOrDefaultAsync(
                                inventory => inventory.ProjectId == adjustment.ProjectId && inventory.MaterialId == item.MaterialId,
                                cancellationToken);
                        if (currentInventory != null)
                        {
                            currentInventory.ReservedQuantity = System.Math.Max(
                                0,
                                currentInventory.ReservedQuantity - baseQuantity);
                            currentInventory.LastUpdated = System.DateTime.UtcNow;
                            _unitOfWork.Repository<CurrentInventory>().Update(currentInventory);
                        }
                    }

                    if (linkedIncident != null)
                    {
                        linkedIncident.Status = "Rejected";
                        linkedIncident.ReviewedBy = _currentUserService.GetRequiredUserId();
                        linkedIncident.HandlingInstruction = $"Giám đốc đã từ chối phiếu giảm tồn kho liên quan. Lý do: {request.RejectedReason}";
                        _unitOfWork.Repository<Incident>().Update(linkedIncident);
                    }
                }

                await SaveDecisionAsync(cancellationToken);

                if (linkedIncident != null)
                {
                    await SendIncidentUpdatedAsync(linkedIncident, cancellationToken);
                }

                // Gửi thông báo DB cho người tạo phiếu
                if (adjustment.CreatedBy.HasValue)
                {
                    var notifTitle = isIncrease ? "Phiếu điều chỉnh tăng tồn bị từ chối" : "Phiếu điều chỉnh giảm tồn bị từ chối";
                    var notifBody = isIncrease
                        ? $"Phiếu điều chỉnh tăng tồn #{adjustment.AdjustmentId} đã bị Trưởng phòng kỹ thuật từ chối. Lý do: {request.RejectedReason}"
                        : $"Phiếu điều chỉnh giảm tồn #{adjustment.AdjustmentId} đã bị Giám đốc từ chối. Lý do: {request.RejectedReason}";

                    await _notificationService.SendNotificationAsync(
                        adjustment.CreatedBy.Value,
                        notifTitle,
                        notifBody,
                        BPG.Domain.Constants.NotificationType.Procurement,
                        $"/projects/{adjustment.ProjectId}/workspace/inventoryadjustments",
                        adjustment.AdjustmentId,
                        cancellationToken
                    );
                }

                // Gửi thông báo DB cho người báo cáo sự cố kho (nếu có sự cố liên kết)
                if (linkedIncident != null && linkedIncident.ReportedBy != _currentUserService.GetRequiredUserId())
                {
                    await _notificationService.SendNotificationAsync(
                        linkedIncident.ReportedBy,
                        "Báo cáo sự cố vật tư kho bị từ chối",
                        $"Sự cố vật tư kho bạn báo cáo tại dự án đã bị từ chối do phiếu giảm tồn kho bị từ chối. Lý do: {request.RejectedReason}",
                        "IncidentRejected",
                        $"/projects/{linkedIncident.ProjectId}/workspace/incidents",
                        linkedIncident.IncidentId,
                        cancellationToken
                    );
                }

                // Realtime: broadcast to all members currently viewing this project
                await _realtimeSender.SendToGroupAsync(
                    HubMethodNames.GroupProject + adjustment.ProjectId,
                    HubMethodNames.InventoryAdjustmentUpdated,
                    adjustment.AdjustmentId,
                    cancellationToken);

                // Realtime: broadcast to all members viewing global incidents (Project_0)
                await _realtimeSender.SendToGroupAsync(
                    HubMethodNames.GroupProject + 0,
                    HubMethodNames.InventoryAdjustmentUpdated,
                    adjustment.AdjustmentId,
                    cancellationToken);

                return ApiResponse<bool>.SuccessResult(true, isIncrease ? "Đã từ chối phiếu điều chỉnh tăng tồn" : "Đã từ chối phiếu điều chỉnh giảm tồn");
            }

            // Approve: Update inventory and create transaction
            adjustment.Status = InventoryAdjustmentStatus.Approved;
            adjustment.ApprovedBy = _currentUserService.GetRequiredUserId();
            adjustment.ApprovedAt = System.DateTime.UtcNow;

            foreach (var item in adjustment.Items)
            {
                var baseQuantity = GetBaseQuantity(item);
                var currentInventory = await _unitOfWork.Repository<CurrentInventory>()
                    .FirstOrDefaultAsync(x => x.ProjectId == adjustment.ProjectId && x.MaterialId == item.MaterialId, cancellationToken);

                if (isIncrease)
                {
                    if (currentInventory == null)
                    {
                        var material = await _unitOfWork.Repository<MaterialCatalog>()
                            .Query()
                            .IgnoreQueryFilters()
                            .FirstOrDefaultAsync(
                                candidate => candidate.MaterialId == item.MaterialId,
                                cancellationToken)
                            ?? throw new NotFoundException(nameof(MaterialCatalog), item.MaterialId);

                        currentInventory = new CurrentInventory
                        {
                            ProjectId = adjustment.ProjectId,
                            MaterialId = item.MaterialId,
                            UnitId = material.BaseUnitId,
                            Quantity = baseQuantity,
                            LastUpdated = System.DateTime.UtcNow
                        };
                        await _unitOfWork.Repository<CurrentInventory>().AddAsync(currentInventory);
                    }
                    else
                    {
                        currentInventory.Quantity += baseQuantity;
                        currentInventory.LastUpdated = System.DateTime.UtcNow;
                        _unitOfWork.Repository<CurrentInventory>().Update(currentInventory);
                    }

                    var transaction = new InventoryTransaction
                    {
                        ProjectId = adjustment.ProjectId,
                        MaterialId = item.MaterialId,
                        TransactionType = InventoryTransactionType.Adjustment,
                        QuantityChange = baseQuantity, // Inventory ledger is always in base units.
                        BalanceAfter = currentInventory.Quantity,
                        ReferenceId = adjustment.AdjustmentId,
                        ReferenceType = EntityType.InventoryAdjustment,
                        CreatedBy = _currentUserService.GetRequiredUserId(),
                        CreatedAt = System.DateTime.UtcNow
                    };
                    await _unitOfWork.Repository<InventoryTransaction>().AddAsync(transaction);
                }
                else
                {
                    if (currentInventory == null || currentInventory.Quantity < baseQuantity)
                    {
                        throw new BusinessException("ERR_INSUFFICIENT_STOCK", $"Không đủ tồn kho cho vật tư ID {item.MaterialId}");
                    }

                    currentInventory.Quantity -= baseQuantity;
                    currentInventory.ReservedQuantity = System.Math.Max(
                        0,
                        currentInventory.ReservedQuantity - baseQuantity);
                    currentInventory.LastUpdated = System.DateTime.UtcNow;
                    _unitOfWork.Repository<CurrentInventory>().Update(currentInventory);

                    var transaction = new InventoryTransaction
                    {
                        ProjectId = adjustment.ProjectId,
                        MaterialId = item.MaterialId,
                        TransactionType = linkedIncident != null
                            ? InventoryTransactionType.IncidentLoss
                            : InventoryTransactionType.Adjustment,
                        QuantityChange = -baseQuantity,
                        BalanceAfter = currentInventory.Quantity,
                        ReferenceId = adjustment.AdjustmentId,
                        ReferenceType = EntityType.InventoryAdjustment,
                        CreatedBy = _currentUserService.GetRequiredUserId(),
                        CreatedAt = System.DateTime.UtcNow
                    };
                    await _unitOfWork.Repository<InventoryTransaction>().AddAsync(transaction);
                }
            }

            _unitOfWork.Repository<InventoryAdjustment>().Update(adjustment);

            if (!isIncrease && linkedIncident != null)
            {
                linkedIncident.Status = "Approved";
                linkedIncident.ReviewedBy = _currentUserService.GetRequiredUserId();
                linkedIncident.HandlingInstruction = "Giám đốc đã phê duyệt phiếu giảm tồn kho liên quan.";
                _unitOfWork.Repository<Incident>().Update(linkedIncident);
            }

            await SaveDecisionAsync(cancellationToken);

            if (linkedIncident != null)
            {
                await SendIncidentUpdatedAsync(linkedIncident, cancellationToken);
            }

            // Gửi thông báo DB cho người tạo phiếu
            if (adjustment.CreatedBy.HasValue)
            {
                var notifTitle = isIncrease ? "Phiếu điều chỉnh tăng tồn được phê duyệt" : "Phiếu điều chỉnh giảm tồn được phê duyệt";
                var notifBody = isIncrease
                    ? $"Phiếu điều chỉnh tăng tồn #{adjustment.AdjustmentId} đã được Trưởng phòng kỹ thuật phê duyệt. Tồn kho đã được cập nhật."
                    : $"Phiếu điều chỉnh giảm tồn #{adjustment.AdjustmentId} đã được Giám đốc phê duyệt. Tồn kho đã được cập nhật.";

                await _notificationService.SendNotificationAsync(
                    adjustment.CreatedBy.Value,
                    notifTitle,
                    notifBody,
                    BPG.Domain.Constants.NotificationType.Procurement,
                    $"/projects/{adjustment.ProjectId}/workspace/inventoryadjustments",
                    adjustment.AdjustmentId,
                    cancellationToken
                );
            }

            // Gửi thông báo DB cho người báo cáo sự cố kho (nếu có sự cố liên kết)
            if (!isIncrease && linkedIncident != null && linkedIncident.ReportedBy != _currentUserService.GetRequiredUserId())
            {
                await _notificationService.SendNotificationAsync(
                    linkedIncident.ReportedBy,
                    "Báo cáo sự cố vật tư kho đã được phê duyệt",
                    $"Sự cố vật tư kho bạn báo cáo tại dự án đã được Giám đốc phê duyệt qua phiếu điều chỉnh giảm tồn kho #{adjustment.AdjustmentId}.",
                    "IncidentApproved",
                    $"/projects/{linkedIncident.ProjectId}/workspace/incidents",
                    linkedIncident.IncidentId,
                    cancellationToken
                );
            }

            // Realtime: broadcast to all members currently viewing this project
            await _realtimeSender.SendToGroupAsync(
                HubMethodNames.GroupProject + adjustment.ProjectId,
                HubMethodNames.InventoryAdjustmentUpdated,
                adjustment.AdjustmentId,
                cancellationToken);

            // Realtime: broadcast to all members viewing global incidents (Project_0)
            await _realtimeSender.SendToGroupAsync(
                HubMethodNames.GroupProject + 0,
                HubMethodNames.InventoryAdjustmentUpdated,
                adjustment.AdjustmentId,
                cancellationToken);

            return ApiResponse<bool>.SuccessResult(true, isIncrease ? "Phê duyệt phiếu điều chỉnh tăng tồn thành công" : "Phê duyệt phiếu điều chỉnh giảm tồn thành công");
        }

        private static decimal GetBaseQuantity(AdjustmentItem item)
            => InventoryAdjustmentQuantity.ToBase(item);

        private async Task SaveDecisionAsync(CancellationToken cancellationToken)
        {
            try
            {
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new BusinessException(
                    "ERR_ADJUSTMENT_ALREADY_PROCESSED",
                    "Phiếu điều chỉnh đã được xử lý bởi một phiên làm việc khác. Vui lòng tải lại dữ liệu.");
            }
            catch (DbUpdateException exception) when (IsCurrentInventoryUniqueViolation(exception))
            {
                throw new BusinessException(
                    "ERR_INVENTORY_STATE_CHANGED",
                    "Tồn kho vật tư đã được khởi tạo bởi một phiên làm việc khác. Vui lòng tải lại và thử lại.");
            }
        }

        private static bool IsCurrentInventoryUniqueViolation(DbUpdateException exception)
        {
            for (Exception? current = exception; current != null; current = current.InnerException)
            {
                var numberProperty = current.GetType().GetProperty("Number");
                if (numberProperty?.GetValue(current) is int number
                    && (number == 2601 || number == 2627)
                    && current.Message.Contains(
                        "IX_CurrentInventories_ProjectId_MaterialId_UnitId",
                        StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }

        private async Task SendIncidentUpdatedAsync(
            Incident linkedIncident,
            CancellationToken cancellationToken)
        {
            await _realtimeSender.SendToGroupAsync(
                HubMethodNames.GroupProject + linkedIncident.ProjectId,
                HubMethodNames.IncidentUpdated,
                linkedIncident.IncidentId,
                cancellationToken);

            await _realtimeSender.SendToGroupAsync(
                HubMethodNames.GroupProject + 0,
                HubMethodNames.IncidentUpdated,
                linkedIncident.IncidentId,
                cancellationToken);
        }
    }
}
