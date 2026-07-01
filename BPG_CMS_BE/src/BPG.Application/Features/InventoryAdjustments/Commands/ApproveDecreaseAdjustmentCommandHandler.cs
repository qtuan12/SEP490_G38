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

        public ApproveDecreaseAdjustmentCommandHandler(IUnitOfWork unitOfWork, ICurrentUserService currentUserService)
        {
            _unitOfWork = unitOfWork;
            _currentUserService = currentUserService;
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
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                return ApiResponse<bool>.SuccessResult(true, "Đã từ chối phiếu điều chỉnh giảm tồn");
            }

            // Approve: Deduct inventory and create transaction
            adjustment.Status = InventoryAdjustmentStatus.Approved;
            adjustment.ApprovedBy = _currentUserService.GetRequiredUserId();
            adjustment.ApprovedAt = System.DateTime.UtcNow;

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
                    TransactionType = InventoryTransactionType.Adjustment,
                    QuantityChange = -item.Quantity, // Âm cho giảm
                    BalanceAfter = currentInventory.Quantity,
                    ReferenceId = adjustment.AdjustmentId,
                    ReferenceType = EntityType.InventoryAdjustment
                };
                await _unitOfWork.Repository<InventoryTransaction>().AddAsync(transaction);
            }

            _unitOfWork.Repository<InventoryAdjustment>().Update(adjustment);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return ApiResponse<bool>.SuccessResult(true, "Phê duyệt phiếu điều chỉnh giảm tồn thành công");
        }
    }
}
