using BPG.Application.Common.Models;
using BPG.Application.DTOs.PurchaseOrders;
using MediatR;

namespace BPG.Application.Features.PurchaseOrders.Queries
{
    public class GetPurchaseOrdersQuery : PaginationRequest, IRequest<PagedList<PurchaseOrderDto>>
    {
        public long? ProjectId { get; set; }
        public string? Status { get; set; }
        public string? PONumber { get; set; }
    }
}
