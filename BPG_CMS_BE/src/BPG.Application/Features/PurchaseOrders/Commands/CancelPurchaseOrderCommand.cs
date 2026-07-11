using MediatR;

namespace BPG.Application.Features.PurchaseOrders.Commands
{
    public class CancelPurchaseOrderCommand : IRequest<bool>
    {
        public long POId { get; init; }
        public string Reason { get; init; } = string.Empty;
    }
}
