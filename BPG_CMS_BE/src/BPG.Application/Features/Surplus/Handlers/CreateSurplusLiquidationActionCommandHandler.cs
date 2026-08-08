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

/// <summary>
/// Kế toán tạo action thanh lý: ghi nhận giá trị thu hồi, giảm tồn kho, ghi ledger.
/// </summary>
public class CreateSurplusLiquidationActionCommandHandler : IRequestHandler<CreateSurplusLiquidationActionCommand, ApiResponse<long>>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly IInventoryService _inventoryService;
    private readonly IFileStorageService _fileStorage;
    private readonly INotificationService _notificationService;

    public CreateSurplusLiquidationActionCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser, IInventoryService inventoryService, IFileStorageService fileStorage, INotificationService notificationService)
    {
        _uow = uow;
        _currentUser = currentUser;
        _inventoryService = inventoryService;
        _fileStorage = fileStorage;
        _notificationService = notificationService;
    }

    public async Task<ApiResponse<long>> Handle(CreateSurplusLiquidationActionCommand request, CancellationToken ct)
    {
        var userId = _currentUser.GetRequiredUserId();

        var item = await _uow.Repository<SurplusRequestItem>().Query()
            .Include(i => i.SurplusRequest)
                .ThenInclude(sr => sr.Project)
            .Include(i => i.Unit)
            .FirstOrDefaultAsync(i => i.SurplusRequestItemId == request.SurplusRequestItemId, ct)
            ?? throw new NotFoundException(nameof(SurplusRequestItem), request.SurplusRequestItemId);

        if (item.SurplusRequest.Project.Status != ProjectStatus.InProgress)
            throw new BusinessException(ErrorCodes.InvalidTransition, "Dự án phải đang hoạt động để thực hiện thao tác này.");

        if (item.SurplusRequest.Status == SurplusRequestStatus.Processed)
            throw new BusinessException(ErrorCodes.AlreadyApproved, "Batch đã hoàn tất, không thể thêm action mới.");

        if (item.Unit != null && item.Unit.IsDiscrete && request.LiquidationQuantity % 1 != 0)
            throw new BusinessException(ErrorCodes.InvalidUnitQuantity, $"Đơn vị tính '{item.Unit.UnitName}' yêu cầu số lượng phải là số nguyên.");

        var pendingTransferQuantity = await _uow.Repository<SurplusTransfer>().Query()
            .Where(t => t.SurplusRequestItemId == item.SurplusRequestItemId
                && t.Status != SurplusTransferStatus.Rejected
                && t.Status != SurplusTransferStatus.Received)
            .SumAsync(t => (decimal?)t.TransferQuantity, ct) ?? 0m;
        var remainingUncommittedQuantity = item.Quantity - item.ProcessedQuantity - pendingTransferQuantity;
        if (request.LiquidationQuantity > remainingUncommittedQuantity)
            throw new BusinessException(ErrorCodes.InsufficientStock, $"Số lượng thanh lý ({request.LiquidationQuantity.ToString("G29")}) vượt quá số lượng chưa được phân bổ ({remainingUncommittedQuantity.ToString("G29")}).");

        var inventory = await _uow.Repository<CurrentInventory>().Query()
            .FirstOrDefaultAsync(ci => ci.ProjectId == item.SurplusRequest.ProjectId && ci.MaterialId == item.MaterialId, ct)
            ?? throw new BusinessException(ErrorCodes.InsufficientStock, "Vật tư không tồn tại trong kho dự án.");
        var availableQuantity = inventory.Quantity - inventory.ReservedQuantity;
        if (request.LiquidationQuantity > availableQuantity)
            throw new BusinessException(ErrorCodes.InsufficientStock, $"Không đủ tồn kho khả dụng để thanh lý. Khả dụng: {availableQuantity.ToString("G29")}, yêu cầu: {request.LiquidationQuantity.ToString("G29")}.");

        var liquidation = new SurplusLiquidation
        {
            SurplusRequestItemId = request.SurplusRequestItemId,
            BuyerName = request.BuyerName,
            LiquidationQuantity = request.LiquidationQuantity,
            TotalAmount = request.TotalAmount
        };

        await _uow.BeginTransactionAsync(ct);
        try
        {
            await _uow.Repository<SurplusLiquidation>().AddAsync(liquidation, ct);

        item.ProcessedQuantity += request.LiquidationQuantity;
        item.Status = item.ProcessedQuantity >= item.Quantity
            ? SurplusRequestItemStatus.Completed
            : SurplusRequestItemStatus.Processing;
        _uow.Repository<SurplusRequestItem>().Update(item);

            await _uow.SaveChangesAsync(ct);

            if (request.Attachments != null && request.Attachments.Any())
            {
                foreach (var file in request.Attachments)
                {
                    var fileUrl = await _fileStorage.UploadFileAsync(file, "surplus_liquidations", ct);
                    var attachment = new Attachment
                    {
                        EntityType = EntityType.SurplusLiquidation,
                        EntityId = liquidation.SurplusLiquidationId,
                        AttachmentType = AttachmentType.SurplusEvidence,
                        FileName = file.FileName,
                        FileUrl = fileUrl,
                        ContentType = file.ContentType,
                        FileSizeBytes = file.Length
                    };
                    await _uow.Repository<Attachment>().AddAsync(attachment, ct);
                }
                await _uow.SaveChangesAsync(ct);
            }

        // Reduce inventory and log transaction
            await _inventoryService.UpdateStockAsync(
                item.SurplusRequest.ProjectId,
                item.MaterialId,
                -request.LiquidationQuantity,
                InventoryTransactionType.Liquidation,
                liquidation.SurplusLiquidationId,
                EntityType.SurplusRequest,
                userId,
                ct);

            await UpdateBatchStatusIfDoneAsync(item.SurplusRequestId, ct);
            await _uow.CommitTransactionAsync(ct);
        }
        catch
        {
            await _uow.RollbackTransactionAsync(ct);
            throw;
        }

        // Notifications
        var notiTitle = "Thông báo thanh lý vật tư thừa";
        var notiContent = $"Vật tư thừa từ dự án {item.SurplusRequest.Project.Name} đã được thanh lý.";

        // 1. Notify Accountant
        await _notificationService.SendNotificationToRoleAsync(
            Domain.Constants.UserRole.Accountant,
            notiTitle, notiContent,
            NotificationType.Procurement, NotificationLink.ProjectSurplus(item.SurplusRequest.ProjectId), item.SurplusRequestId, ct);

        // 2. Notify Technical Manager
        await _notificationService.SendNotificationToRoleAsync(
            Domain.Constants.UserRole.TechnicalManager,
            notiTitle, notiContent,
            NotificationType.Procurement, NotificationLink.ProjectSurplus(item.SurplusRequest.ProjectId), item.SurplusRequestId, ct);

        // 3. Notify Project Leader
        var projectLeaderId = await _uow.Repository<ProjectMember>().Query()
            .Where(pm => pm.ProjectId == item.SurplusRequest.ProjectId && pm.IsLeader)
            .Select(pm => pm.UserId)
            .FirstOrDefaultAsync(ct);
        if (projectLeaderId > 0)
        {
            await _notificationService.SendNotificationAsync(
                projectLeaderId,
                notiTitle, notiContent,
                NotificationType.Procurement, NotificationLink.ProjectSurplus(item.SurplusRequest.ProjectId), item.SurplusRequestId, ct);
        }

        return ApiResponse<long>.SuccessResult(liquidation.SurplusLiquidationId, ResponseMessages.CreateSuccess);
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
