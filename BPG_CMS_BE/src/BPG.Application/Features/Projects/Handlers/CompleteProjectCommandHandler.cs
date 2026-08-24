namespace BPG.Application.Features.Projects.Handlers;

using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

public class CompleteProjectCommandHandler : IRequestHandler<CompleteProjectCommand, MediatR.Unit>
{
    private static readonly string[] TerminalIncidentStatuses =
    [
        IncidentStatus.Approved,
        IncidentStatus.Rejected,
        IncidentStatus.Resolved,
        IncidentStatus.Closed
    ];

    private static readonly string[] TerminalMaterialRequestStatuses =
    [
        MaterialRequestStatus.Approved,
        MaterialRequestStatus.Rejected,
        MaterialRequestStatus.Cancelled
    ];

    private static readonly string[] TerminalPurchaseOrderStatuses =
    [
        PurchaseOrderStatus.FullyReceived,
        PurchaseOrderStatus.Closed,
        PurchaseOrderStatus.Cancelled,
        PurchaseOrderStatus.Rejected
    ];

    private static readonly string[] TerminalInventoryAdjustmentStatuses =
    [
        InventoryAdjustmentStatus.Approved,
        InventoryAdjustmentStatus.Rejected,
        InventoryAdjustmentStatus.Cancelled
    ];

    private static readonly string[] TerminalDirectPurchaseStatuses =
    [
        DirectPurchaseStatus.Approved,
        DirectPurchaseStatus.Rejected
    ];

    private static readonly string[] TerminalSurplusTransferStatuses =
    [
        SurplusTransferStatus.Received,
        SurplusTransferStatus.Rejected
    ];

    private readonly IUnitOfWork _uow;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotificationSender _realtimeSender;
    private readonly ICurrentUserService _currentUserService;

    public CompleteProjectCommandHandler(
        IUnitOfWork uow,
        INotificationService notificationService,
        IRealtimeNotificationSender realtimeSender,
        ICurrentUserService currentUserService)
    {
        _uow = uow;
        _notificationService = notificationService;
        _realtimeSender = realtimeSender;
        _currentUserService = currentUserService;
    }

    public async Task<MediatR.Unit> Handle(CompleteProjectCommand request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>()
            .Query()
            .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, cancellationToken);

        if (project == null)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.Status != ProjectStatus.InProgress)
            throw new BusinessException(ErrorCodes.ProjectNotInProgress, $"Chỉ có thể hoàn thành dự án khi đang ở trạng thái Đang chạy (InProgress). Trạng thái hiện tại: {project.Status}");

        var phaseCount = await _uow.Repository<Phase>()
            .Query()
            .AsNoTracking()
            .CountAsync(phase => phase.ProjectId == request.ProjectId, cancellationToken);

        if (phaseCount == 0)
            throw new BusinessException(ErrorCodes.ProjectHasNoPhases, "Dự án chưa có giai đoạn thi công nên chưa thể hoàn thành.");

        // Obsolete tasks are no longer part of the valid execution plan. Every
        // remaining task must be both 100% and in a terminal work status.
        var uncompletedTaskCount = await _uow.Repository<ProjectTask>()
            .Query()
            .AsNoTracking()
            .Where(t => t.Phase.ProjectId == request.ProjectId
                        && t.Status != BPG.Domain.Constants.TaskStatus.Obsolete
                        && (t.ProgressPercent < 100
                            || (t.Status != BPG.Domain.Constants.TaskStatus.Completed
                                && t.Status != BPG.Domain.Constants.TaskStatus.Approved)))
            .CountAsync(cancellationToken);

        if (uncompletedTaskCount > 0)
        {
            throw new BusinessException(ErrorCodes.ProjectTasksNotCompleted, $"Dự án còn {uncompletedTaskCount} công việc chưa hoàn thành. Mọi công việc còn hiệu lực phải đạt 100% và có trạng thái Hoàn thành/Đã duyệt.");
        }

        var unacceptedPhaseCount = await _uow.Repository<Phase>()
            .Query()
            .AsNoTracking()
            .CountAsync(phase => phase.ProjectId == request.ProjectId
                && phase.Status != PhaseStatus.Approved
                // A phase whose entire historical WBS was made obsolete by an
                // incident is retired from the valid execution plan. It cannot be
                // accepted (there is no active task), so it must not block the
                // replacement phase from completing the project. Empty draft phases
                // still block completion because they were never an execution plan.
                && (!phase.Tasks.Any()
                    || phase.Tasks.Any(task => task.Status != BPG.Domain.Constants.TaskStatus.Obsolete)),
                cancellationToken);

        if (unacceptedPhaseCount > 0)
            throw new BusinessException(ErrorCodes.ProjectPhasesNotAccepted, $"Dự án còn {unacceptedPhaseCount} giai đoạn chưa được nghiệm thu. Vui lòng nghiệm thu toàn bộ giai đoạn trước khi hoàn thành dự án.");

        var pendingIncidentCount = await _uow.Repository<Incident>()
            .Query()
            .AsNoTracking()
            .CountAsync(incident => incident.ProjectId == request.ProjectId
                && !TerminalIncidentStatuses.Contains(incident.Status), cancellationToken);

        if (pendingIncidentCount > 0)
            throw new BusinessException(ErrorCodes.ProjectHasPendingIncidents, $"Dự án còn {pendingIncidentCount} sự cố chưa được xử lý/phê duyệt.");

        var pendingMaterialRequestCount = await _uow.Repository<MaterialRequest>()
            .Query()
            .AsNoTracking()
            .CountAsync(materialRequest => materialRequest.Phase.ProjectId == request.ProjectId
                && !TerminalMaterialRequestStatuses.Contains(materialRequest.Status), cancellationToken);

        if (pendingMaterialRequestCount > 0)
            throw new BusinessException(ErrorCodes.ProjectHasPendingMaterialRequests, $"Dự án còn {pendingMaterialRequestCount} yêu cầu vật tư chưa xử lý xong.");

        var pendingPurchaseOrderCount = await _uow.Repository<PurchaseOrder>()
            .Query()
            .AsNoTracking()
            .CountAsync(po => po.ProjectId == request.ProjectId
                && !TerminalPurchaseOrderStatuses.Contains(po.Status), cancellationToken);

        if (pendingPurchaseOrderCount > 0)
            throw new BusinessException(ErrorCodes.ProjectHasPendingPurchaseOrders, $"Dự án còn {pendingPurchaseOrderCount} đơn mua hàng chưa kết thúc giao/nhận.");

        var pendingGoodsReceiptCount = await _uow.Repository<GoodsReceipt>()
            .Query()
            .AsNoTracking()
            .CountAsync(receipt => receipt.PurchaseOrder.ProjectId == request.ProjectId
                && receipt.Status != GoodsReceiptStatus.Approved
                && receipt.Status != GoodsReceiptStatus.Cancelled, cancellationToken);

        if (pendingGoodsReceiptCount > 0)
            throw new BusinessException(ErrorCodes.ProjectHasPendingGoodsReceipts, $"Dự án còn {pendingGoodsReceiptCount} phiếu nhập kho chưa hoàn tất.");

        var pendingAdjustmentCount = await _uow.Repository<InventoryAdjustment>()
            .Query()
            .AsNoTracking()
            .CountAsync(adjustment => adjustment.ProjectId == request.ProjectId
                && !TerminalInventoryAdjustmentStatuses.Contains(adjustment.Status), cancellationToken);

        if (pendingAdjustmentCount > 0)
            throw new BusinessException(ErrorCodes.ProjectHasPendingInventoryAdjustments, $"Dự án còn {pendingAdjustmentCount} phiếu điều chỉnh kho chưa xử lý xong.");

        var pendingDirectPurchaseCount = await _uow.Repository<DirectPurchaseRequest>()
            .Query()
            .AsNoTracking()
            .CountAsync(directPurchase => directPurchase.ProjectId == request.ProjectId
                && !TerminalDirectPurchaseStatuses.Contains(directPurchase.Status), cancellationToken);

        if (pendingDirectPurchaseCount > 0)
            throw new BusinessException(ErrorCodes.ProjectHasPendingDirectPurchases, $"Dự án còn {pendingDirectPurchaseCount} phiếu mua khẩn cấp chưa quyết toán xong.");

        var pendingSurplusRequestCount = await _uow.Repository<SurplusRequest>()
            .Query()
            .AsNoTracking()
            .CountAsync(surplus => surplus.ProjectId == request.ProjectId
                && surplus.Status != SurplusRequestStatus.Processed, cancellationToken);

        var pendingSurplusTransferCount = await _uow.Repository<SurplusTransfer>()
            .Query()
            .AsNoTracking()
            .CountAsync(transfer => (transfer.FromProjectId == request.ProjectId || transfer.ToProjectId == request.ProjectId)
                && !TerminalSurplusTransferStatuses.Contains(transfer.Status), cancellationToken);

        if (pendingSurplusRequestCount + pendingSurplusTransferCount > 0)
            throw new BusinessException(ErrorCodes.ProjectHasPendingSurplus, $"Dự án còn {pendingSurplusRequestCount} đợt xử lý vật tư thừa và {pendingSurplusTransferCount} phiếu chuyển kho chưa hoàn tất.");

        var userId = _currentUserService.UserId;
        var userName = "Hệ thống";
        if (userId.HasValue)
        {
            var user = await _uow.Repository<User>().GetByIdAsync(userId.Value, cancellationToken);
            if (user != null)
            {
                userName = user.FullName;
            }
        }

        project.PauseReason = AppendStatusHistory(
            project.PauseReason,
            "complete",
            "Hoàn thành dự án",
            System.DateTime.UtcNow,
            userName);

        project.Status = ProjectStatus.Completed;
        _uow.Repository<Project>().Update(project);
        await _uow.SaveChangesAsync(cancellationToken);

        // Fetch and notify all project members
        var projectMembers = await _uow.Repository<ProjectMember>()
            .Query()
            .Where(pm => pm.ProjectId == project.ProjectId)
            .ToListAsync(cancellationToken);

        foreach (var pm in projectMembers)
        {
            if (userId.HasValue && pm.UserId == userId.Value) continue;

            await _notificationService.SendNotificationAsync(
                pm.UserId,
                "🎉 Dự án đã hoàn thành",
                $"Dự án {project.Name} đã được xác nhận hoàn thành bởi {userName}.",
                NotificationType.Progress,
                NotificationReferenceType.Project,
                project.ProjectId,
                cancellationToken
            );
        }

        // Notify Key Roles (Director, TechnicalManager, Accountant)
        if (userId.HasValue)
        {
            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Director,
                "🎉 Dự án đã hoàn thành",
                $"Dự án {project.Name} đã được xác nhận hoàn thành bởi {userName}.",
                NotificationType.Progress,
                userId.Value,
                NotificationReferenceType.Project,
                project.ProjectId,
                cancellationToken
            );

            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.TechnicalManager,
                "🎉 Dự án đã hoàn thành",
                $"Dự án {project.Name} đã được xác nhận hoàn thành bởi {userName}.",
                NotificationType.Progress,
                userId.Value,
                NotificationReferenceType.Project,
                project.ProjectId,
                cancellationToken
            );

            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Accountant,
                "🎉 Dự án đã hoàn thành",
                $"Dự án {project.Name} đã được xác nhận hoàn thành bởi {userName}.",
                NotificationType.Progress,
                userId.Value,
                NotificationReferenceType.Project,
                project.ProjectId,
                cancellationToken
            );
        }

        await _realtimeSender.SendToGroupAsync(
            HubMethodNames.GroupProject + project.ProjectId,
            HubMethodNames.ProjectUpdated,
            new { ProjectId = project.ProjectId, Status = project.Status },
            cancellationToken);

        await _realtimeSender.SendToGroupAsync(
            HubMethodNames.GroupProject + 0,
            HubMethodNames.ProjectUpdated,
            new { ProjectId = project.ProjectId, Status = project.Status },
            cancellationToken);

        return MediatR.Unit.Value;
    }

    private string AppendStatusHistory(string? currentReason, string type, string? reason, System.DateTime timestamp, string userName)
    {
        List<StatusHistoryItem> historyList;
        if (!string.IsNullOrEmpty(currentReason) && currentReason.Trim().StartsWith("["))
        {
            try
            {
                historyList = JsonSerializer.Deserialize<List<StatusHistoryItem>>(currentReason) ?? new List<StatusHistoryItem>();
            }
            catch
            {
                historyList = new List<StatusHistoryItem>();
            }
        }
        else
        {
            historyList = new List<StatusHistoryItem>();
            if (!string.IsNullOrEmpty(currentReason))
            {
                historyList.Add(new StatusHistoryItem
                {
                    Type = "pause",
                    Reason = currentReason,
                    Timestamp = System.DateTime.UtcNow,
                    User = "Hệ thống"
                });
            }
        }

        historyList.Add(new StatusHistoryItem
        {
            Type = type,
            Reason = reason,
            Timestamp = timestamp,
            User = userName
        });

        return JsonSerializer.Serialize(historyList);
    }

    private class StatusHistoryItem
    {
        public string Type { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public System.DateTime Timestamp { get; set; }
        public string User { get; set; } = string.Empty;
    }
}
