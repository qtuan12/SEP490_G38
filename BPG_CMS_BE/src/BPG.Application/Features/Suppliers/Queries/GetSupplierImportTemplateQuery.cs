using MediatR;

namespace BPG.Application.Features.Suppliers.Queries
{
    public record GetSupplierImportTemplateQuery() : IRequest<byte[]>;
}
