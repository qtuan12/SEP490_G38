using AutoMapper;
using BPG.Application.DTOs.Suppliers;
using BPG.Application.Features.Suppliers.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Suppliers.Handlers
{
    public class UpdateSupplierCommandHandler : IRequestHandler<UpdateSupplierCommand, SupplierDto>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public UpdateSupplierCommandHandler(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<SupplierDto> Handle(UpdateSupplierCommand request, CancellationToken cancellationToken)
        {
            var supplier = await _uow.Repository<Supplier>().GetByIdAsync(request.SupplierId, cancellationToken);
            if (supplier == null)
            {
                throw new NotFoundException("Supplier", request.SupplierId);
            }

            var trimmedName = request.SupplierName.Trim();
            // Kiểm tra trùng tên với nhà cung cấp khác
            var nameExists = await _uow.Repository<Supplier>().AnyAsync(
                s => s.SupplierId != request.SupplierId && s.SupplierName.Trim().ToLower() == trimmedName.ToLower(),
                cancellationToken
            );

            if (nameExists)
            {
                throw new DuplicateEntryException("SupplierName", request.SupplierName);
            }

            supplier.SupplierName = trimmedName;
            supplier.ContactInfo = request.ContactInfo?.Trim();
            supplier.Address = request.Address?.Trim();
            supplier.ServiceArea = request.ServiceArea?.Trim();
            supplier.Rating = request.Rating;
            supplier.EvaluationNote = request.EvaluationNote?.Trim();
            supplier.CollaborationStatus = request.CollaborationStatus;

            _uow.Repository<Supplier>().Update(supplier);
            await _uow.SaveChangesAsync(cancellationToken);

            return _mapper.Map<SupplierDto>(supplier);
        }
    }
}
