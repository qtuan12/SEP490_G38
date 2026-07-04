using MediatR;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialRequests.Commands
{
    public record ApproveMaterialRequestByDirectorCommand(long RequestId, string? Note) : IRequest<ApiResponse<bool>>;

    public class ApproveMaterialRequestByDirectorCommandHandler : IRequestHandler<ApproveMaterialRequestByDirectorCommand, ApiResponse<bool>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;

        public ApproveMaterialRequestByDirectorCommandHandler(IUnitOfWork uow, ICurrentUserService currentUserService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
        }

        public async Task<ApiResponse<bool>> Handle(ApproveMaterialRequestByDirectorCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            var mr = await _uow.Repository<MaterialRequest>().Query()
                .Include(x => x.Items)
                .FirstOrDefaultAsync(x => x.RequestId == request.RequestId, cancellationToken);

            if (mr == null)
            {
                throw new NotFoundException(nameof(MaterialRequest), request.RequestId);
            }

            if (mr.Status != MaterialRequestStatus.WaitingApproval)
            {
                throw new BusinessException("ERR_INVALID_STATUS_FOR_APPROVAL", 
                    $"Phiếu yêu cầu vật tư đang ở trạng thái: {mr.Status}. Chỉ hỗ trợ duyệt phiếu ở trạng thái Chờ Giám đốc duyệt (WaitingApproval).");
            }

            await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                // 1. Phê duyệt yêu cầu và lưu thông tin
                mr.Status = MaterialRequestStatus.Approved;
                mr.ApprovedBy = currentUserId;
                mr.ApprovalNote = request.Note;
                mr.UpdatedAt = DateTime.UtcNow;
                mr.UpdatedBy = currentUserId;

                _uow.Repository<MaterialRequest>().Update(mr);

                // 2. Tạo đơn PO dạng nháp (Draft PO) tự động
                var vnNow = DateTime.UtcNow.AddHours(7);
                var poNumber = $"PO-{vnNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

                var purchaseOrder = new PurchaseOrder
                {
                    RequestId = mr.RequestId,
                    PONumber = poNumber,
                    OrderDate = DateTime.UtcNow,
                    Status = PurchaseOrderStatus.Draft,
                    TotalAmount = 0m,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = currentUserId
                };

                await _uow.Repository<PurchaseOrder>().AddAsync(purchaseOrder, cancellationToken);
                await _uow.SaveChangesAsync(cancellationToken); // Phát sinh POId

                var poItems = mr.Items.Select(item => new PurchaseOrderItem
                {
                    POId = purchaseOrder.POId,
                    MaterialId = item.MaterialId,
                    UnitId = item.UnitId,
                    Quantity = item.Quantity,
                    UnitPrice = 0m,
                    LineTotal = 0m,
                    ConversionRate = item.ConversionRate
                }).ToList();

                await _uow.Repository<PurchaseOrderItem>().AddRangeAsync(poItems, cancellationToken);

                await _uow.SaveChangesAsync(cancellationToken);
                await _uow.CommitTransactionAsync(cancellationToken);

                return ApiResponse<bool>.SuccessResult(true, "Giám đốc phê duyệt yêu cầu vật tư thành công (Đã tự động tạo PO nháp).");
            }
            catch (Exception)
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }
        }
    }
}
