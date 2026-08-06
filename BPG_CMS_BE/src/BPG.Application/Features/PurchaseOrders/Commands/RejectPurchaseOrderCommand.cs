using MediatR;

namespace BPG.Application.Features.PurchaseOrders.Commands
{
    /// <summary>
    /// Giám đốc từ chối đơn mua hàng đang chờ duyệt. Số lượng vật tư của đơn được trả lại
    /// yêu cầu vật tư để kế toán lập đơn khác.
    /// </summary>
    public class RejectPurchaseOrderCommand : IRequest<bool>
    {
        public long POId { get; init; }
        public string Reason { get; init; } = string.Empty;
    }
}
