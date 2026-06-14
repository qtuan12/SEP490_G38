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
    public class CreateSupplierCommandHandler : IRequestHandler<CreateSupplierCommand, SupplierDto>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public CreateSupplierCommandHandler(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<SupplierDto> Handle(CreateSupplierCommand request, CancellationToken cancellationToken)
        {
            var trimmedName = request.SupplierName.Trim();
            // Kiểm tra trùng tên nhà cung cấp (với những NCC chưa bị xóa mềm)
            var nameExists = await _uow.Repository<Supplier>().AnyAsync(
                s => s.SupplierName.Trim().ToLower() == trimmedName.ToLower(),
                cancellationToken
            );

            if (nameExists)
            {
                throw new DuplicateEntryException("SupplierName", request.SupplierName);
            }

            var supplier = new Supplier
            {
                SupplierName = trimmedName,
                ContactInfo = request.ContactInfo?.Trim(),
                Address = request.Address?.Trim(),
                ServiceArea = request.ServiceArea?.Trim(),
                Rating = request.Rating,
                EvaluationNote = request.EvaluationNote?.Trim(),
                CollaborationStatus = request.CollaborationStatus
            };

            await _uow.Repository<Supplier>().AddAsync(supplier, cancellationToken);
            await _uow.SaveChangesAsync(cancellationToken);

            return _mapper.Map<SupplierDto>(supplier);
        }
    }
}
