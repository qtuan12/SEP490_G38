using BPG.Application.Features.Suppliers.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Suppliers.Handlers
{
    public class DeleteSupplierCommandHandler : IRequestHandler<DeleteSupplierCommand, bool>
    {
        private readonly IUnitOfWork _uow;

        public DeleteSupplierCommandHandler(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<bool> Handle(DeleteSupplierCommand request, CancellationToken cancellationToken)
        {
            var supplier = await _uow.Repository<Supplier>().GetByIdAsync(request.SupplierId, cancellationToken);
            if (supplier == null)
            {
                throw new NotFoundException("Supplier", request.SupplierId);
            }

            var hasActivePurchaseOrders = await _uow.Repository<PurchaseOrder>().Query()
                .AsNoTracking()
                .AnyAsync(po => po.SupplierId == request.SupplierId
                    && po.Status != BPG.Domain.Constants.PurchaseOrderStatus.FullyReceived
                    && po.Status != BPG.Domain.Constants.PurchaseOrderStatus.Closed
                    && po.Status != BPG.Domain.Constants.PurchaseOrderStatus.Cancelled
                    && po.Status != BPG.Domain.Constants.PurchaseOrderStatus.Rejected,
                    cancellationToken);

            if (hasActivePurchaseOrders)
            {
                throw new BusinessException("ERR_SUPPLIER_HAS_ACTIVE_ORDERS",
                    "Không thể xóa nhà cung cấp đang có đơn mua hàng chưa kết thúc.");
            }

            // Xóa mềm bằng cách set IsDeleted = true
            supplier.IsDeleted = true;

            _uow.Repository<Supplier>().Update(supplier);
            await _uow.SaveChangesAsync(cancellationToken);

            return true;
        }
    }
}
