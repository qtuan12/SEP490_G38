using MediatR;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    /// <summary>
    /// Gửi phiếu nháp. Đây là điểm không thể quay lại: hệ thống validate đầy đủ,
    /// tính BOQCheckStatus, sinh PO + GoodsReceipt và cộng tồn kho.
    /// </summary>
    public record SubmitDirectPurchaseCommand(long DirectPurchaseId) : IRequest<bool>;
}
