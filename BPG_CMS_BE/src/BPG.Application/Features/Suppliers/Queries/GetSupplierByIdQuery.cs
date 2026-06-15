using BPG.Application.DTOs.Suppliers;
using MediatR;

namespace BPG.Application.Features.Suppliers.Queries
{
    public record GetSupplierByIdQuery(long SupplierId) : IRequest<SupplierDto>;
}
