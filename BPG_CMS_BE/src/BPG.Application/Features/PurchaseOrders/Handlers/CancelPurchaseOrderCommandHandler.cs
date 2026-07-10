using BPG.Application.Features.PurchaseOrders.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PurchaseOrders.Handlers
{
    public class CancelPurchaseOrderCommandHandler : IRequestHandler<CancelPurchaseOrderCommand, bool>
    {
        private readonly IUnitOfWork _uow;

        public CancelPurchaseOrderCommandHandler(IUnitOfWork uow) => _uow = uow;

        public async Task<bool> Handle(CancelPurchaseOrderCommand request, CancellationToken cancellationToken)
        {
            var po = await _uow.Repository<PurchaseOrder>().Query()
                .FirstOrDefaultAsync(p => p.POId == request.POId, cancellationToken)
                ?? throw new NotFoundException(nameof(PurchaseOrder), request.POId);

            if (po.Status == PurchaseOrderStatus.Cancelled)
                throw new BusinessException("ERR_PO_ALREADY_CANCELLED", "Đơn mua hàng đã bị hủy trước đó.");

            if (po.Status == PurchaseOrderStatus.PartiallyReceived ||
                po.Status == PurchaseOrderStatus.FullyReceived ||
                po.Status == PurchaseOrderStatus.Closed)
                throw new BusinessException("ERR_PO_CANNOT_CANCEL",
                    "Không thể hủy đơn mua hàng đã có hàng nhận hoặc đã đóng.");

            // Check no approved goods receipts exist
            var hasReceipts = await _uow.Repository<GoodsReceipt>().Query()
                .AnyAsync(gr => gr.POId == request.POId && gr.Status == GoodsReceiptStatus.Approved,
                    cancellationToken);

            if (hasReceipts)
                throw new BusinessException("ERR_PO_HAS_RECEIPTS",
                    "Không thể hủy đơn mua hàng đã có phiếu nhập kho được duyệt.");

            po.Status = PurchaseOrderStatus.Cancelled;
            po.CancelledReason = request.Reason.Trim();

            await _uow.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
