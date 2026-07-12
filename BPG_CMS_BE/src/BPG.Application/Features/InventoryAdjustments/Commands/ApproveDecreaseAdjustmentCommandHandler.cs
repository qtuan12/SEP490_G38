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
                .Include(a => a.Items)
                .FirstOrDefaultAsync(a => a.AdjustmentId == request.AdjustmentId, cancellationToken);

            if (adjustment == null) throw new NotFoundException(nameof(InventoryAdjustment), request.AdjustmentId);

            if (adjustment.Status != InventoryAdjustmentStatus.Pending)
                throw new BusinessException("ERR_INVALID_STATUS", "Phiếu không ở trạng thái chờ duyệt");

            if (!request.IsApproved)
            {
                adjustment.Status = InventoryAdjustmentStatus.Rejected;
                adjustment.RejectedReason = request.RejectedReason;
                adjustment.ApprovedBy = _currentUserService.GetRequiredUserId();
                adjustment.ApprovedAt = System.DateTime.UtcNow;

                _unitOfWork.Repository<InventoryAdjustment>().Update(adjustment);

                Incident rejIncident = null;
                if (!string.IsNullOrEmpty(adjustment.Description) && adjustment.Description.Contains("[System] Liên kết sự cố #"))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(adjustment.Description, @"\[System\] Liên kết sự cố #(\d+)");
                    if (match.Success)
                    {
                        var incidentId = long.Parse(match.Groups[1].Value);
                        rejIncident = await _unitOfWork.Repository<Incident>().Query()
                            .FirstOrDefaultAsync(i => i.IncidentId == incidentId, cancellationToken);
                    }
                }

                if (rejIncident == null)
                {
                    rejIncident = await _unitOfWork.Repository<Incident>().Query()
                        .Where(i => i.ProjectId == adjustment.ProjectId && i.PhaseId == adjustment.PhaseId && i.Status == "WaitingDirector")
                        .OrderBy(i => i.IncidentId)
                        .FirstOrDefaultAsync(cancellationToken);
                }

                if (rejIncident != null)
                {
                    rejIncident.Status = "Rejected";
                    rejIncident.ReviewedBy = _currentUserService.GetRequiredUserId();
                    rejIncident.HandlingInstruction = $"Giám đốc đã từ chối phiếu giảm tồn kho liên quan. Lý do: {request.RejectedReason}";
                    _unitOfWork.Repository<Incident>().Update(rejIncident);

                    await _realtimeSender.SendToGroupAsync(
                        HubMethodNames.GroupProject + rejIncident.ProjectId,
                        HubMethodNames.IncidentUpdated,
                        rejIncident.IncidentId,
                        cancellationToken);

                    await _realtimeSender.SendToGroupAsync(
                        HubMethodNames.GroupProject + 0,
                        HubMethodNames.IncidentUpdated,
                        rejIncident.IncidentId,
                        cancellationToken);
                }

                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Gửi thông báo DB cho người tạo phiếu
                if (adjustment.CreatedBy.HasValue)
                {
                    await _notificationService.SendNotificationAsync(
                        adjustment.CreatedBy.Value,
                        "Phiếu điều chỉnh giảm tồn bị từ chối",
                        $"Phiếu điều chỉnh giảm tồn #{adjustment.AdjustmentId} đã bị Giám đốc từ chối. Lý do: {request.RejectedReason}",
                        BPG.Domain.Constants.NotificationType.Procurement,
                        $"/projects/{adjustment.ProjectId}/workspace/inventoryadjustments",
                        adjustment.AdjustmentId,
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

                return ApiResponse<bool>.SuccessResult(true, "Đã từ chối phiếu điều chỉnh giảm tồn");
            }

            // Approve: Deduct inventory and create transaction
            adjustment.Status = InventoryAdjustmentStatus.Approved;
            adjustment.ApprovedBy = _currentUserService.GetRequiredUserId();
            adjustment.ApprovedAt = System.DateTime.UtcNow;

            Incident appIncident = null;
            if (!string.IsNullOrEmpty(adjustment.Description) && adjustment.Description.Contains("[System] Liên kết sự cố #"))
            {
                var match = System.Text.RegularExpressions.Regex.Match(adjustment.Description, @"\[System\] Liên kết sự cố #(\d+)");
                if (match.Success)
                {
                    var incidentId = long.Parse(match.Groups[1].Value);
                    appIncident = await _unitOfWork.Repository<Incident>().Query()
                        .FirstOrDefaultAsync(i => i.IncidentId == incidentId, cancellationToken);
                }
            }

            if (appIncident == null)
            {
                appIncident = await _unitOfWork.Repository<Incident>().Query()
                    .Where(i => i.ProjectId == adjustment.ProjectId && i.PhaseId == adjustment.PhaseId && i.Status == "WaitingDirector")
                    .OrderBy(i => i.IncidentId)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            foreach (var item in adjustment.Items)
            {
                var currentInventory = await _unitOfWork.Repository<CurrentInventory>()
                    .FirstOrDefaultAsync(x => x.ProjectId == adjustment.ProjectId && x.MaterialId == item.MaterialId, cancellationToken);

                if (currentInventory == null || currentInventory.Quantity < item.Quantity)
                {
                    throw new BusinessException("ERR_INSUFFICIENT_STOCK", $"Không đủ tồn kho cho vật tư ID {item.MaterialId}");
                }

                currentInventory.Quantity -= item.Quantity;
                currentInventory.LastUpdated = System.DateTime.UtcNow;
                _unitOfWork.Repository<CurrentInventory>().Update(currentInventory);

                var transaction = new InventoryTransaction
                {
                    ProjectId = adjustment.ProjectId,
                    MaterialId = item.MaterialId,
                    TransactionType = (appIncident != null) ? (byte)9 : InventoryTransactionType.Adjustment,
                    QuantityChange = -item.Quantity, // Âm cho giảm
                    BalanceAfter = currentInventory.Quantity,
                    ReferenceId = adjustment.AdjustmentId,
                    ReferenceType = EntityType.InventoryAdjustment,
                    CreatedBy = _currentUserService.GetRequiredUserId(),
                    CreatedAt = System.DateTime.UtcNow
                };
                await _unitOfWork.Repository<InventoryTransaction>().AddAsync(transaction);
            }

            _unitOfWork.Repository<InventoryAdjustment>().Update(adjustment);

            if (appIncident != null)
            {
                appIncident.Status = "Approved";
                appIncident.ReviewedBy = _currentUserService.GetRequiredUserId();
                appIncident.HandlingInstruction = "Giám đốc đã phê duyệt phiếu giảm tồn kho liên quan.";
                _unitOfWork.Repository<Incident>().Update(appIncident);

                await _realtimeSender.SendToGroupAsync(
                    HubMethodNames.GroupProject + appIncident.ProjectId,
                    HubMethodNames.IncidentUpdated,
                    appIncident.IncidentId,
                    cancellationToken);

                await _realtimeSender.SendToGroupAsync(
                    HubMethodNames.GroupProject + 0,
                    HubMethodNames.IncidentUpdated,
                    appIncident.IncidentId,
                    cancellationToken);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            // Gửi thông báo DB cho người tạo phiếu
            if (adjustment.CreatedBy.HasValue)
            {
                await _notificationService.SendNotificationAsync(
                    adjustment.CreatedBy.Value,
                    "Phiếu điều chỉnh giảm tồn được phê duyệt",
                    $"Phiếu điều chỉnh giảm tồn #{adjustment.AdjustmentId} đã được Giám đốc phê duyệt. Tồn kho đã được cập nhật.",
                    BPG.Domain.Constants.NotificationType.Procurement,
                    $"/projects/{adjustment.ProjectId}/workspace/inventoryadjustments",
                    adjustment.AdjustmentId,
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

            return ApiResponse<bool>.SuccessResult(true, "Phê duyệt phiếu điều chỉnh giảm tồn thành công");
        }
    }
}
