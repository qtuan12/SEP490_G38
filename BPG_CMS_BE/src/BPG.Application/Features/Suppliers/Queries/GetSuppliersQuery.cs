using BPG.Application.Common.Models;
using BPG.Application.DTOs.Suppliers;
using MediatR;

namespace BPG.Application.Features.Suppliers.Queries
{
    public class GetSuppliersQuery : PaginationRequest, IRequest<PagedList<SupplierDto>>
    {
        public string? CollaborationStatus { get; set; }
    }
}
