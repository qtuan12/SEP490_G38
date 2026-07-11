using BPG.Application.Common.Models;
using BPG.Application.DTOs.PurchaseOrders;
using MediatR;

namespace BPG.Application.Features.PurchaseOrders.Queries
{
    public record GetPurchaseOrderByIdQuery(long POId) : IRequest<ApiResponse<PurchaseOrderDetailDto>>;
}
