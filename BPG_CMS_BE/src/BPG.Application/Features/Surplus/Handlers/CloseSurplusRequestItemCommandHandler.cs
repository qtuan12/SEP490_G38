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

public class CloseSurplusRequestItemCommandHandler
    : IRequestHandler<CloseSurplusRequestItemCommand, ApiResponse>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;

    public CloseSurplusRequestItemCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    {
        _uow = uow;
        _currentUser = currentUser;
    }

    public async Task<ApiResponse> Handle(CloseSurplusRequestItemCommand request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 10)
            throw new BusinessException(ErrorCodes.ValidationFailed, "Lý do đóng phần còn lại phải có ít nhất 10 ký tự.");

        var item = await _uow.Repository<SurplusRequestItem>().Query()
            .Include(i => i.SurplusRequest)
                .ThenInclude(sr => sr.Project)
            .FirstOrDefaultAsync(i => i.SurplusRequestItemId == request.SurplusRequestItemId, ct)
            ?? throw new NotFoundException(nameof(SurplusRequestItem), request.SurplusRequestItemId);

        if (item.SurplusRequest.Project.Status != ProjectStatus.InProgress)
            throw new BusinessException(ErrorCodes.InvalidTransition, "Dự án phải đang hoạt động để thực hiện thao tác này.");

        if (item.SurplusRequest.Status != SurplusRequestStatus.Processing)
            throw new BusinessException(ErrorCodes.InvalidTransition, "Đợt xử lý đã hoàn tất.");
        if (item.Status == SurplusRequestItemStatus.Completed || item.Status == SurplusRequestItemStatus.Cancelled)
            throw new BusinessException(ErrorCodes.InvalidTransition, "Dòng vật tư đã được đóng.");

        var hasActiveTransfer = await _uow.Repository<SurplusTransfer>().Query()
            .AnyAsync(t => t.SurplusRequestItemId == item.SurplusRequestItemId
                && t.Status != SurplusTransferStatus.Rejected
                && t.Status != SurplusTransferStatus.Received, ct);
        if (hasActiveTransfer)
            throw new BusinessException(ErrorCodes.InvalidTransition, "Không thể đóng khi vật tư còn phiếu điều chuyển đang chờ xử lý.");

        var userId = _currentUser.GetRequiredUserId();
        var now = DateTime.UtcNow;
        item.Status = SurplusRequestItemStatus.Cancelled;
        item.CloseReason = request.Reason.Trim();
        item.UpdatedAt = now;
        item.UpdatedBy = userId;
        _uow.Repository<SurplusRequestItem>().Update(item);

        // 🔓 Giải phóng phần ReservedQuantity chưa được xử lý (Quantity - ProcessedQuantity)
        // vì item được đóng, số lượng này sẽ không được xử lý nữa.
        var unprocessedQty = item.Quantity - item.ProcessedQuantity;
        if (unprocessedQty > 0)
        {
            var inv = await _uow.Repository<CurrentInventory>().Query()
                .FirstOrDefaultAsync(
                    ci => ci.ProjectId == item.SurplusRequest.ProjectId && ci.MaterialId == item.MaterialId,
                    ct);
            if (inv != null)
            {
                inv.ReservedQuantity = Math.Max(0, inv.ReservedQuantity - unprocessedQty);
                inv.LastUpdated = now;
                _uow.Repository<CurrentInventory>().Update(inv);
            }
        }

        var allOtherItemsDone = await _uow.Repository<SurplusRequestItem>().Query()
            .Where(i => i.SurplusRequestId == item.SurplusRequestId
                && i.SurplusRequestItemId != item.SurplusRequestItemId)
            .AllAsync(i => i.Status == SurplusRequestItemStatus.Completed
                || i.Status == SurplusRequestItemStatus.Cancelled, ct);
        if (allOtherItemsDone)
        {
            item.SurplusRequest.Status = SurplusRequestStatus.Processed;
            item.SurplusRequest.UpdatedAt = now;
            item.SurplusRequest.UpdatedBy = userId;
            _uow.Repository<SurplusRequest>().Update(item.SurplusRequest);
        }

        await _uow.SaveChangesAsync(ct);
        return ApiResponse.SuccessResult("Đã đóng phần vật tư còn lại.");
    }
}
