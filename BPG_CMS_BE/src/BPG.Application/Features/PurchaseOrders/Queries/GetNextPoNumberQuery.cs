using MediatR;

namespace BPG.Application.Features.PurchaseOrders.Queries
{
    public record GetNextPoNumberQuery(DateTime OrderDate) : IRequest<string>;
}
