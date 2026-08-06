using MediatR;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    /// <summary>
    /// Gửi phiếu nháp. Đây là điểm không thể quay lại: hệ thống validate đầy đủ,
    /// tính BOQCheckStatus, sinh PO + GoodsReceipt và cộng tồn kho.
    /// Trả về message mô tả bước kế tiếp — mọi phiếu đều đi tiếp tới Kế toán rồi Giám đốc.
    /// </summary>
    public record SubmitDirectPurchaseCommand(long DirectPurchaseId) : IRequest<string>;
}
