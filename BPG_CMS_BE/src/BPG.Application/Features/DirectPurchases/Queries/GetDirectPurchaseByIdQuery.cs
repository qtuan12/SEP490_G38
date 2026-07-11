using BPG.Application.DTOs.DirectPurchases;
using MediatR;

namespace BPG.Application.Features.DirectPurchases.Queries
{
    public record GetDirectPurchaseByIdQuery(long DirectPurchaseId) : IRequest<DirectPurchaseDetailDto>;
}
