using BPG.Application.Features.Suppliers.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
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

            // Xóa mềm bằng cách set IsDeleted = true
            supplier.IsDeleted = true;

            _uow.Repository<Supplier>().Update(supplier);
            await _uow.SaveChangesAsync(cancellationToken);

            return true;
        }
    }
}
