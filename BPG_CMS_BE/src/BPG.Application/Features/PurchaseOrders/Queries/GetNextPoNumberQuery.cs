using MediatR;

namespace BPG.Application.Features.PurchaseOrders.Queries
{
    public record GetNextPoNumberQuery(DateOnly OrderDate) : IRequest<string>;
}
