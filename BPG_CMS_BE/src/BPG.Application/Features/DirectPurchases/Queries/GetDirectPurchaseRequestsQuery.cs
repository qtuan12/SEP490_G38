using BPG.Application.Common.Models;
using BPG.Application.DTOs.DirectPurchases;
using MediatR;

namespace BPG.Application.Features.DirectPurchases.Queries
{
    public class GetDirectPurchaseRequestsQuery : PaginationRequest, IRequest<PagedList<DirectPurchaseRequestDto>>
    {
        public long? ProjectId { get; set; }
        public string? Status { get; set; }
        public string? AuditStatus { get; set; }
        public long? RequestedBy { get; set; }
        public string? SearchTerm { get; set; }
    }
}
