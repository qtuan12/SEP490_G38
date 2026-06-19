using MediatR;

namespace BPG.Application.Features.Suppliers.Commands
{
    public record DeleteSupplierCommand(long SupplierId) : IRequest<bool>;
}
