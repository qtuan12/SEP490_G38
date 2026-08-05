using BPG.Application.Common.Models;
using BPG.Application.Common.Attributes;
using BPG.Application.DTOs.Suppliers;
using MediatR;

namespace BPG.Application.Features.Suppliers.Queries
{
    [Cacheable(DurationSeconds = 300)]
    public class GetSuppliersQuery : PaginationRequest, IRequest<PagedList<SupplierDto>>
    {
        public string? CollaborationStatus { get; set; }
    }
}
