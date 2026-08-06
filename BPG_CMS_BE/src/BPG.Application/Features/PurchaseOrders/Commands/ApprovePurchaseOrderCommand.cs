using MediatR;

namespace BPG.Application.Features.PurchaseOrders.Commands
{
    /// <summary>
    /// Giám đốc duyệt đơn mua hàng đang chờ duyệt. Sau khi duyệt đơn mới được gửi
    /// nhà cung cấp và mới cho phép lập phiếu nhập kho.
    /// </summary>
    public class ApprovePurchaseOrderCommand : IRequest<bool>
    {
        public long POId { get; init; }
        public string? Note { get; init; }
    }
}
