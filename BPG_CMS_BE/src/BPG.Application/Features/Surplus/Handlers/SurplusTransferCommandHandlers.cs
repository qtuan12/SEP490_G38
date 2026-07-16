using BPG.Application.Common.Models;
using BPG.Application.Features.Surplus.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Surplus.Handlers;

public class CreateSurplusTransferActionCommandHandler : IRequestHandler<CreateSurplusTransferActionCommand, ApiResponse<long>>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly INotificationService _notificationService;

    public CreateSurplusTransferActionCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser, INotificationService notificationService)
    {
        _uow = uow;
        _currentUser = currentUser;
        _notificationService = notificationService;
    }

    public async Task<ApiResponse<long>> Handle(CreateSurplusTransferActionCommand request, CancellationToken ct)
    {
        var userId = _currentUser.GetRequiredUserId();

        var item = await _uow.Repository<SurplusRequestItem>().Query()
            .Include(i => i.SurplusRequest)
                .ThenInclude(sr => sr.Project)
            .Include(i => i.Unit)
            .FirstOrDefaultAsync(i => i.SurplusRequestItemId == request.SurplusRequestItemId, ct)
            ?? throw new NotFoundException(nameof(SurplusRequestItem), request.SurplusRequestItemId);

        if (item.SurplusRequest.Status == SurplusRequestStatus.Processed)
            throw new BusinessException(ErrorCodes.AlreadyApproved, "Batch đã hoàn tất, không thể thêm action mới.");

        var fromProjectId = item.SurplusRequest.ProjectId;
        var fromProjectName = item.SurplusRequest.Project.Name;
        
        if (request.ToProjectId == fromProjectId)
            throw new BusinessException(ErrorCodes.InvalidTransition, "Dự án nguồn và dự án nhận không được trùng nhau.");

        // Verify target project exists and is active
        var toProject = await _uow.Repository<Project>().Query()
            .FirstOrDefaultAsync(p => p.ProjectId == request.ToProjectId, ct)
            ?? throw new NotFoundException(nameof(Project), request.ToProjectId);
        if (toProject.Status != ProjectStatus.InProgress)
            throw new BusinessException(ErrorCodes.InvalidTransition, "Dự án nhận phải đang hoạt động.");

        if (item.Unit != null && item.Unit.IsDiscrete && request.TransferQuantity % 1 != 0)
            throw new BusinessException(ErrorCodes.InvalidUnitQuantity, $"Đơn vị tính '{item.Unit.UnitName}' yêu cầu số lượng phải là số nguyên.");

        if (request.TransferQuantity > (item.Quantity - item.ProcessedQuantity))
            throw new BusinessException(ErrorCodes.InsufficientStock, $"Số lượng chuyển ({request.TransferQuantity}) vượt quá số lượng còn lại ({item.Quantity - item.ProcessedQuantity}).");

        var conversionRate = item.ConversionRate > 0 ? item.ConversionRate : 1m;
        var baseTransferQty = request.TransferQuantity / conversionRate;

        // Reserve inventory in the sending project
        var inv = await _uow.Repository<CurrentInventory>().Query()
            .FirstOrDefaultAsync(ci => ci.ProjectId == fromProjectId && ci.MaterialId == item.MaterialId, ct)
            ?? throw new BusinessException(ErrorCodes.InsufficientStock, $"Vật tư không tồn tại trong kho của dự án.");

        if ((inv.Quantity - inv.ReservedQuantity) < baseTransferQty)
            throw new BusinessException(ErrorCodes.InsufficientStock, $"Không đủ tồn kho khả dụng để chuyển. Tồn kho khả dụng: {inv.Quantity - inv.ReservedQuantity}, Yêu cầu chuyển: {baseTransferQty} (base unit).");

        inv.ReservedQuantity += baseTransferQty;
        inv.LastUpdated = DateTime.UtcNow;
        _uow.Repository<CurrentInventory>().Update(inv);

        var transfer = new SurplusTransfer
        {
            SurplusRequestItemId = request.SurplusRequestItemId,
            FromProjectId = fromProjectId,
            ToProjectId = request.ToProjectId,
            TransferQuantity = request.TransferQuantity,
            Status = SurplusTransferStatus.Pending
        };

        await _uow.Repository<SurplusTransfer>().AddAsync(transfer, ct);
        await _uow.SaveChangesAsync(ct);

        // Notifications (loại trừ người tạo - userId)
        var notiTitle = "Chờ duyệt chuyển kho vật tư thừa";
        var notiContent = $"Đề xuất chuyển kho [{transfer.SurplusTransferId}] từ dự án [{fromProjectName}] sang [{toProject.Name}] đang chờ phê duyệt.";

        // 1. Thông báo đến Trưởng phòng kỹ thuật (trừ người tạo)
        await _notificationService.SendNotificationToRoleAsync(
            Domain.Constants.UserRole.TechnicalManager,
            notiTitle, notiContent,
            NotificationType.Procurement,
            excludeUserId: userId,
            NotificationReferenceType.SurplusRequest,
            transfer.SurplusTransferId,
            ct);

        // 2. Thông báo đến Kế toán (trừ người tạo)
        await _notificationService.SendNotificationToRoleAsync(
            Domain.Constants.UserRole.Accountant,
            notiTitle, notiContent,
            NotificationType.Procurement,
            excludeUserId: userId,
            NotificationReferenceType.SurplusRequest,
            transfer.SurplusTransferId,
            ct);

        // 3. Thông báo đến Project Leader của dự án nguồn (trừ người tạo)
        var projectLeaderId = await _uow.Repository<ProjectMember>().Query()
            .Where(pm => pm.ProjectId == fromProjectId && pm.IsLeader && pm.UserId != userId)
            .Select(pm => pm.UserId)
            .FirstOrDefaultAsync(ct);
        if (projectLeaderId > 0)
        {
            await _notificationService.SendNotificationAsync(
                projectLeaderId,
                notiTitle, notiContent,
                NotificationType.Procurement,
                NotificationReferenceType.SurplusRequest,
                transfer.SurplusTransferId,
                ct);
        }

        return ApiResponse<long>.SuccessResult(transfer.SurplusTransferId, ResponseMessages.CreateSuccess);
    }
}

public class ReviewSurplusTransferCommandHandler : IRequestHandler<ReviewSurplusTransferCommand, ApiResponse>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly INotificationService _notificationService;

    public ReviewSurplusTransferCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser, INotificationService notificationService)
    {
        _uow = uow;
        _currentUser = currentUser;
        _notificationService = notificationService;
    }

    public async Task<ApiResponse> Handle(ReviewSurplusTransferCommand request, CancellationToken ct)
    {
        var userId = _currentUser.GetRequiredUserId();

        var transfer = await _uow.Repository<SurplusTransfer>().Query()
            .Include(t => t.SurplusRequestItem)
                .ThenInclude(i => i.SurplusRequest)
            .FirstOrDefaultAsync(t => t.SurplusTransferId == request.SurplusTransferId, ct)
            ?? throw new NotFoundException(nameof(SurplusTransfer), request.SurplusTransferId);

        if (transfer.Status != SurplusTransferStatus.Pending)
            throw new InvalidStatusTransitionException(nameof(SurplusTransfer), transfer.Status, request.IsApproved ? SurplusTransferStatus.Approved : SurplusTransferStatus.Rejected);

        transfer.Status = request.IsApproved ? SurplusTransferStatus.Approved : SurplusTransferStatus.Rejected;
        transfer.ApprovedBy = userId;
        transfer.ApprovedAt = DateTime.UtcNow;
        _uow.Repository<SurplusTransfer>().Update(transfer);

        if (!request.IsApproved)
        {
            // Release reserved quantity on item if rejected
            var item = transfer.SurplusRequestItem;
            item.Status = item.ProcessedQuantity > 0 ? SurplusRequestItemStatus.Processing : SurplusRequestItemStatus.Pending;
            _uow.Repository<SurplusRequestItem>().Update(item);

            // Release inventory hold
            var conversionRate = item.ConversionRate > 0 ? item.ConversionRate : 1m;
            var baseTransferQty = transfer.TransferQuantity / conversionRate;
            
            var inv = await _uow.Repository<CurrentInventory>().Query()
                .FirstOrDefaultAsync(ci => ci.ProjectId == transfer.FromProjectId && ci.MaterialId == item.MaterialId, ct);
            if (inv != null)
            {
                inv.ReservedQuantity -= baseTransferQty;
                if (inv.ReservedQuantity < 0) inv.ReservedQuantity = 0;
                inv.LastUpdated = DateTime.UtcNow;
                _uow.Repository<CurrentInventory>().Update(inv);
            }
        }

        await _uow.SaveChangesAsync(ct);

        // Thông báo kết quả phê duyệt
        var reviewTitle = "Kết quả duyệt chuyển kho";
        var reviewMsg = request.IsApproved
            ? $"Đề xuất chuyển kho [{transfer.SurplusTransferId}] đã được TPKT phê duyệt. Hãy tiến hành vận chuyển."
            : $"Đề xuất chuyển kho [{transfer.SurplusTransferId}] đã bị từ chối bởi TPKT.";

        // 1. Thông báo đến Leader dự án nguồn (trừ người phê duyệt)
        var senderLeader = await _uow.Repository<ProjectMember>().Query()
            .Where(m => m.ProjectId == transfer.FromProjectId && m.IsLeader && m.UserId != userId)
            .Select(m => m.UserId)
            .FirstOrDefaultAsync(ct);
        if (senderLeader != 0)
        {
            await _notificationService.SendNotificationAsync(
                senderLeader, reviewTitle, reviewMsg,
                NotificationType.Procurement, NotificationReferenceType.SurplusRequest,
                transfer.SurplusTransferId, ct);
        }

        // 2. Thông báo đến Kế toán (trừ người phê duyệt)
        await _notificationService.SendNotificationToRoleAsync(
            Domain.Constants.UserRole.Accountant,
            reviewTitle, reviewMsg,
            NotificationType.Procurement,
            excludeUserId: userId,
            NotificationReferenceType.SurplusRequest,
            transfer.SurplusTransferId,
            ct);

        return ApiResponse.SuccessResult(request.IsApproved ? ResponseMessages.ApproveSuccess : ResponseMessages.RejectSuccess);
    }
}

public class DispatchSurplusTransferCommandHandler : IRequestHandler<DispatchSurplusTransferCommand, ApiResponse>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly INotificationService _notificationService;
    private readonly IFileStorageService _fileStorage;

    public DispatchSurplusTransferCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser, INotificationService notificationService, IFileStorageService fileStorage)
    {
        _uow = uow;
        _currentUser = currentUser;
        _notificationService = notificationService;
        _fileStorage = fileStorage;
    }

    public async Task<ApiResponse> Handle(DispatchSurplusTransferCommand request, CancellationToken ct)
    {
        var userId = _currentUser.GetRequiredUserId();

        if (request.Attachments == null || !request.Attachments.Any())
            throw new BusinessException(ErrorCodes.ValidationFailed, "Bắt buộc phải tải lên ít nhất 1 file minh chứng phiếu xuất / ảnh chụp.");

        var transfer = await _uow.Repository<SurplusTransfer>().Query()
            .Include(t => t.ToProject)
            .FirstOrDefaultAsync(t => t.SurplusTransferId == request.SurplusTransferId, ct)
            ?? throw new NotFoundException(nameof(SurplusTransfer), request.SurplusTransferId);

        if (transfer.Status != SurplusTransferStatus.Approved)
            throw new InvalidStatusTransitionException(nameof(SurplusTransfer), transfer.Status, SurplusTransferStatus.Dispatched);

        transfer.Status = SurplusTransferStatus.Dispatched;
        transfer.DispatchedBy = userId;
        transfer.DispatchedAt = DateTime.UtcNow;
        _uow.Repository<SurplusTransfer>().Update(transfer);

        // Upload attachments
        foreach (var file in request.Attachments)
        {
            var fileUrl = await _fileStorage.UploadFileAsync(file, "surplus_transfer_dispatches", ct);
            var fileAttachment = new Attachment
            {
                EntityType = EntityType.SurplusTransferDispatch,
                EntityId = transfer.SurplusTransferId,
                FileName = file.FileName,
                FileUrl = fileUrl,
                ContentType = file.ContentType,
                FileSizeBytes = file.Length,
                CreatedBy = userId
            };
            await _uow.Repository<Attachment>().AddAsync(fileAttachment, ct);
        }

        await _uow.SaveChangesAsync(ct);

        // Thông báo xác nhận đã gửi
        var dispatchTitle = "Vật tư chuyển kho đang trên đường";
        var dispatchMsg = string.Format(NotificationTemplates.SurplusTransferDispatched, transfer.SurplusTransferId);

        // 1. Thông báo đến Leader dự án đích (trừ người dispatch)
        var receiverLeader = await _uow.Repository<ProjectMember>().Query()
            .Where(m => m.ProjectId == transfer.ToProjectId && m.IsLeader && m.UserId != userId)
            .Select(m => m.UserId)
            .FirstOrDefaultAsync(ct);
        if (receiverLeader != 0)
        {
            await _notificationService.SendNotificationAsync(
                receiverLeader, dispatchTitle, dispatchMsg,
                NotificationType.Procurement, NotificationReferenceType.SurplusRequest,
                transfer.SurplusTransferId, ct);
        }

        // 2. Thông báo đến Trưởng phòng kỹ thuật (trừ người dispatch)
        await _notificationService.SendNotificationToRoleAsync(
            Domain.Constants.UserRole.TechnicalManager,
            dispatchTitle, dispatchMsg,
            NotificationType.Procurement,
            excludeUserId: userId,
            NotificationReferenceType.SurplusRequest,
            transfer.SurplusTransferId,
            ct);

        // 3. Thông báo đến Kế toán (trừ người dispatch)
        await _notificationService.SendNotificationToRoleAsync(
            Domain.Constants.UserRole.Accountant,
            dispatchTitle, dispatchMsg,
            NotificationType.Procurement,
            excludeUserId: userId,
            NotificationReferenceType.SurplusRequest,
            transfer.SurplusTransferId,
            ct);

        return ApiResponse.SuccessResult(ResponseMessages.UpdateSuccess);
    }
}

public class ReceiveSurplusTransferCommandHandler : IRequestHandler<ReceiveSurplusTransferCommand, ApiResponse>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly IInventoryService _inventoryService;
    private readonly INotificationService _notificationService;
    private readonly IFileStorageService _fileStorage;

    public ReceiveSurplusTransferCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser, IInventoryService inventoryService, INotificationService notificationService, IFileStorageService fileStorage)
    {
        _uow = uow;
        _currentUser = currentUser;
        _inventoryService = inventoryService;
        _notificationService = notificationService;
        _fileStorage = fileStorage;
    }

    public async Task<ApiResponse> Handle(ReceiveSurplusTransferCommand request, CancellationToken ct)
    {
        var userId = _currentUser.GetRequiredUserId();

        if (request.Attachments == null || !request.Attachments.Any())
            throw new BusinessException(ErrorCodes.ValidationFailed, "Bắt buộc phải tải lên ít nhất 1 file minh chứng phiếu nhận / ảnh chụp.");

        var transfer = await _uow.Repository<SurplusTransfer>().Query()
            .Include(t => t.SurplusRequestItem)
                .ThenInclude(i => i.SurplusRequest)
            .FirstOrDefaultAsync(t => t.SurplusTransferId == request.SurplusTransferId, ct)
            ?? throw new NotFoundException(nameof(SurplusTransfer), request.SurplusTransferId);

        if (transfer.Status != SurplusTransferStatus.Dispatched)
            throw new InvalidStatusTransitionException(nameof(SurplusTransfer), transfer.Status, SurplusTransferStatus.Received);

        transfer.Status = SurplusTransferStatus.Received;
        transfer.ReceivedBy = userId;
        transfer.ReceivedAt = DateTime.UtcNow;
        _uow.Repository<SurplusTransfer>().Update(transfer);

        // Upload attachments
        foreach (var file in request.Attachments)
        {
            var fileUrl = await _fileStorage.UploadFileAsync(file, "surplus_transfer_receives", ct);
            var fileAttachment = new Attachment
            {
                EntityType = EntityType.SurplusTransferReceive,
                EntityId = transfer.SurplusTransferId,
                FileName = file.FileName,
                FileUrl = fileUrl,
                ContentType = file.ContentType,
                FileSizeBytes = file.Length,
                CreatedBy = userId
            };
            await _uow.Repository<Attachment>().AddAsync(fileAttachment, ct);
        }

        // Update SurplusRequestItem processed quantity
        var item = transfer.SurplusRequestItem;
        item.ProcessedQuantity += transfer.TransferQuantity;
        item.Status = item.ProcessedQuantity >= item.Quantity
            ? SurplusRequestItemStatus.Completed
            : SurplusRequestItemStatus.Processing;
        _uow.Repository<SurplusRequestItem>().Update(item);

        await _uow.SaveChangesAsync(ct);

        var conversionRate = item.ConversionRate > 0 ? item.ConversionRate : 1m;
        var baseTransferQty = transfer.TransferQuantity / conversionRate;

        // TransferOut: reduce from-project inventory
        var fromInv = await _inventoryService.UpdateStockAsync(
            transfer.FromProjectId,
            item.MaterialId,
            -baseTransferQty,
            InventoryTransactionType.TransferOut,
            transfer.SurplusTransferId,
            EntityType.SurplusRequest,
            userId,
            ct);

        // Decrease ReservedQuantity since the items actually left the warehouse
        if (fromInv != null)
        {
            fromInv.ReservedQuantity -= baseTransferQty;
            if (fromInv.ReservedQuantity < 0) fromInv.ReservedQuantity = 0;
            _uow.Repository<CurrentInventory>().Update(fromInv);
        }

        // TransferIn: add to to-project inventory
        await _inventoryService.UpdateStockAsync(
            transfer.ToProjectId,
            item.MaterialId,
            baseTransferQty,
            InventoryTransactionType.TransferIn,
            transfer.SurplusTransferId,
            EntityType.SurplusRequest,
            userId,
            ct);

        await UpdateBatchStatusIfDoneAsync(item.SurplusRequestId, ct);

        // Thông báo xác nhận đã nhận
        var receiveTitle = "Bên nhận đã xác nhận hàng";
        var receiveMsg = string.Format(NotificationTemplates.SurplusTransferReceived, transfer.SurplusTransferId);

        // 1. Thông báo đến người đã dispatch (trừ người đang receive)
        var dispatchedBy = transfer.DispatchedBy;
        if (dispatchedBy.HasValue && dispatchedBy.Value != userId)
        {
            await _notificationService.SendNotificationAsync(
                dispatchedBy.Value, receiveTitle, receiveMsg,
                NotificationType.Procurement, NotificationReferenceType.SurplusRequest,
                transfer.SurplusTransferId, ct);
        }

        // 2. Thông báo đến Trưởng phòng kỹ thuật (trừ người receive)
        await _notificationService.SendNotificationToRoleAsync(
            Domain.Constants.UserRole.TechnicalManager,
            receiveTitle, receiveMsg,
            NotificationType.Procurement,
            excludeUserId: userId,
            NotificationReferenceType.SurplusRequest,
            transfer.SurplusTransferId,
            ct);

        // 3. Thông báo đến Kế toán (trừ người receive)
        await _notificationService.SendNotificationToRoleAsync(
            Domain.Constants.UserRole.Accountant,
            receiveTitle, receiveMsg,
            NotificationType.Procurement,
            excludeUserId: userId,
            NotificationReferenceType.SurplusRequest,
            transfer.SurplusTransferId,
            ct);

        return ApiResponse.SuccessResult(ResponseMessages.UpdateSuccess);
    }

    private async Task UpdateBatchStatusIfDoneAsync(long surplusRequestId, CancellationToken ct)
    {
        var allItems = await _uow.Repository<SurplusRequestItem>().Query()
            .Where(i => i.SurplusRequestId == surplusRequestId)
            .ToListAsync(ct);

        if (allItems.All(i => i.Status == SurplusRequestItemStatus.Completed || i.Status == SurplusRequestItemStatus.Cancelled))
        {
            var batch = await _uow.Repository<SurplusRequest>().GetByIdAsync(surplusRequestId, ct);
            if (batch != null && batch.Status != SurplusRequestStatus.Processed)
            {
                batch.Status = SurplusRequestStatus.Processed;
                _uow.Repository<SurplusRequest>().Update(batch);
                await _uow.SaveChangesAsync(ct);
            }
        }
    }
}
