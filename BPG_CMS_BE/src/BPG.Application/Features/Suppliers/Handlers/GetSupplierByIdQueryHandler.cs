using AutoMapper;
using BPG.Application.DTOs.Suppliers;
using BPG.Application.Features.Suppliers.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Suppliers.Handlers
{
    public class GetSupplierByIdQueryHandler : IRequestHandler<GetSupplierByIdQuery, SupplierDto>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public GetSupplierByIdQueryHandler(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<SupplierDto> Handle(GetSupplierByIdQuery request, CancellationToken cancellationToken)
        {
            var supplier = await _uow.Repository<Supplier>().GetByIdAsync(request.SupplierId, cancellationToken);
            if (supplier == null)
            {
                throw new NotFoundException("Supplier", request.SupplierId);
            }

            return _mapper.Map<SupplierDto>(supplier);
        }
    }
}
