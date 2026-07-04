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
            .FirstOrDefaultAsync(i => i.SurplusRequestItemId == request.SurplusRequestItemId, ct)
            ?? throw new NotFoundException(nameof(SurplusRequestItem), request.SurplusRequestItemId);

        if (item.SurplusRequest.Status == SurplusRequestStatus.Processed)
            throw new BusinessException(ErrorCodes.AlreadyApproved, "Batch đã hoàn tất, không thể thêm action mới.");

        var fromProjectId = item.SurplusRequest.ProjectId;
        if (request.ToProjectId == fromProjectId)
            throw new BusinessException(ErrorCodes.InvalidTransition, "Dự án nguồn và dự án nhận không được trùng nhau.");

        // Verify target project exists and is active
        var toProject = await _uow.Repository<Project>().Query()
            .FirstOrDefaultAsync(p => p.ProjectId == request.ToProjectId, ct)
            ?? throw new NotFoundException(nameof(Project), request.ToProjectId);
        if (toProject.Status != ProjectStatus.InProgress)
            throw new BusinessException(ErrorCodes.InvalidTransition, "Dự án nhận phải đang hoạt động.");

        if (request.TransferQuantity > (item.Quantity - item.ProcessedQuantity))
            throw new BusinessException(ErrorCodes.InsufficientStock, $"Số lượng chuyển ({request.TransferQuantity}) vượt quá số lượng còn lại ({item.Quantity - item.ProcessedQuantity}).");

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

        // Notify TPKT to review
        await _notificationService.SendNotificationToRoleAsync(
            Domain.Constants.UserRole.TechnicalManager,
            "Chờ duyệt chuyển kho vật tư thừa",
            $"Đề xuất chuyển kho [{transfer.SurplusTransferId}] từ dự án [{fromProjectId}] sang [{toProject.Name}] đang chờ phê duyệt.",
            NotificationType.Procurement,
            NotificationReferenceType.SurplusRequest,
            transfer.SurplusTransferId,
            ct);

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
        }

        await _uow.SaveChangesAsync(ct);

        // Notify sender project's leader
        var senderLeader = await _uow.Repository<ProjectMember>().Query()
            .Where(m => m.ProjectId == transfer.FromProjectId && m.IsLeader)
            .Select(m => m.UserId)
            .FirstOrDefaultAsync(ct);
        if (senderLeader != 0)
        {
            var msg = request.IsApproved
                ? $"Đề xuất chuyển kho [{transfer.SurplusTransferId}] đã được TPKT phê duyệt. Hãy tiến hành vận chuyển."
                : $"Đề xuất chuyển kho [{transfer.SurplusTransferId}] đã bị từ chối bởi TPKT.";
            await _notificationService.SendNotificationAsync(
                senderLeader, "Kết quả duyệt chuyển kho", msg,
                NotificationType.Procurement, NotificationReferenceType.SurplusRequest,
                transfer.SurplusTransferId, ct);
        }

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

        // Notify receiver leader
        var receiverLeader = await _uow.Repository<ProjectMember>().Query()
            .Where(m => m.ProjectId == transfer.ToProjectId && m.IsLeader)
            .Select(m => m.UserId)
            .FirstOrDefaultAsync(ct);
        if (receiverLeader != 0)
        {
            await _notificationService.SendNotificationAsync(
                receiverLeader, "Vật tư chuyển kho đang trên đường",
                string.Format(NotificationTemplates.SurplusTransferDispatched, transfer.SurplusTransferId),
                NotificationType.Procurement, NotificationReferenceType.SurplusRequest,
                transfer.SurplusTransferId, ct);
        }

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

        // TransferOut: reduce from-project inventory
        await _inventoryService.UpdateStockAsync(
            transfer.FromProjectId,
            item.MaterialId,
            -transfer.TransferQuantity,
            InventoryTransactionType.TransferOut,
            transfer.SurplusTransferId,
            EntityType.SurplusRequest,
            userId,
            ct);

        // TransferIn: add to to-project inventory
        await _inventoryService.UpdateStockAsync(
            transfer.ToProjectId,
            item.MaterialId,
            transfer.TransferQuantity,
            InventoryTransactionType.TransferIn,
            transfer.SurplusTransferId,
            EntityType.SurplusRequest,
            userId,
            ct);

        await UpdateBatchStatusIfDoneAsync(item.SurplusRequestId, ct);

        await _notificationService.SendNotificationAsync(
            transfer.DispatchedBy ?? userId,
            "Bên nhận đã xác nhận hàng",
            string.Format(NotificationTemplates.SurplusTransferReceived, transfer.SurplusTransferId),
            NotificationType.Procurement, NotificationReferenceType.SurplusRequest,
            transfer.SurplusTransferId, ct);

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
