using BPG.Application.Features.PurchaseOrders.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PurchaseOrders.Handlers
{
    /// <summary>
    /// Kế toán đóng PO đang nhận một phần. Phần vật tư chưa nhận không còn bị PO này
    /// giữ chỗ nữa, cho phép tạo PO khác từ cùng yêu cầu vật tư cho phần còn thiếu.
    /// Không hoàn hay hủy phần đã nhận — tồn kho giữ nguyên.
    /// </summary>
    public class ClosePurchaseOrderCommandHandler : IRequestHandler<ClosePurchaseOrderCommand, bool>
    {
        private readonly IUnitOfWork _uow;

        public ClosePurchaseOrderCommandHandler(IUnitOfWork uow) => _uow = uow;

        public async Task<bool> Handle(ClosePurchaseOrderCommand request, CancellationToken cancellationToken)
        {
            var po = await _uow.Repository<PurchaseOrder>().Query()
                .FirstOrDefaultAsync(p => p.POId == request.POId, cancellationToken)
                ?? throw new NotFoundException(nameof(PurchaseOrder), request.POId);

            if (po.Status != PurchaseOrderStatus.PartiallyReceived)
                throw new BusinessException("ERR_PO_CANNOT_CLOSE",
                    "Chỉ có thể đóng đơn mua hàng đang ở trạng thái nhận một phần.");

            if (string.IsNullOrWhiteSpace(request.Reason))
                throw new BusinessException("ERR_CLOSE_REASON_REQUIRED", "Vui lòng nhập lý do đóng đơn mua hàng.");

            po.Status = PurchaseOrderStatus.Closed;
            po.ClosedReason = request.Reason.Trim();

            await _uow.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
