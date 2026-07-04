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
/// Kế toán xử lý trả NCC: tạo record SurplusReturnSupplier, giảm tồn kho nguồn, ghi InventoryTransaction.
/// </summary>
public class CreateSurplusReturnActionCommandHandler : IRequestHandler<CreateSurplusReturnActionCommand, ApiResponse<long>>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly IInventoryService _inventoryService;

    public CreateSurplusReturnActionCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser, IInventoryService inventoryService)
    {
        _uow = uow;
        _currentUser = currentUser;
        _inventoryService = inventoryService;
    }

    public async Task<ApiResponse<long>> Handle(CreateSurplusReturnActionCommand request, CancellationToken ct)
    {
        var userId = _currentUser.GetRequiredUserId();

        var item = await _uow.Repository<SurplusRequestItem>().Query()
            .Include(i => i.SurplusRequest)
            .FirstOrDefaultAsync(i => i.SurplusRequestItemId == request.SurplusRequestItemId, ct)
            ?? throw new NotFoundException(nameof(SurplusRequestItem), request.SurplusRequestItemId);

        if (item.SurplusRequest.Status == SurplusRequestStatus.Processed)
            throw new BusinessException(ErrorCodes.AlreadyApproved, "Batch đã hoàn tất, không thể thêm action mới.");

        if (request.ReturnQuantity > (item.Quantity - item.ProcessedQuantity))
            throw new BusinessException(ErrorCodes.InsufficientStock, $"Số lượng trả ({request.ReturnQuantity}) vượt quá số lượng còn lại ({item.Quantity - item.ProcessedQuantity}).");

        var returnRecord = new SurplusReturnSupplier
        {
            SurplusRequestItemId = request.SurplusRequestItemId,
            SupplierId = request.SupplierId,
            ReturnQuantity = request.ReturnQuantity,
            RefundAmount = request.RefundAmount,
            Note = request.Note
        };

        await _uow.Repository<SurplusReturnSupplier>().AddAsync(returnRecord, ct);

        // Update processed quantity & item status
        item.ProcessedQuantity += request.ReturnQuantity;
        item.Status = item.ProcessedQuantity >= item.Quantity
            ? SurplusRequestItemStatus.Completed
            : SurplusRequestItemStatus.Processing;
        _uow.Repository<SurplusRequestItem>().Update(item);

        await _uow.SaveChangesAsync(ct);

        // Reduce inventory and log transaction
        await _inventoryService.UpdateStockAsync(
            item.SurplusRequest.ProjectId,
            item.MaterialId,
            -request.ReturnQuantity,
            InventoryTransactionType.ReturnToSupplier,
            returnRecord.SurplusReturnSupplierId,
            EntityType.SurplusRequest,
            userId,
            ct);

        await UpdateBatchStatusIfDoneAsync(item.SurplusRequestId, ct);

        return ApiResponse<long>.SuccessResult(returnRecord.SurplusReturnSupplierId, ResponseMessages.CreateSuccess);
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
