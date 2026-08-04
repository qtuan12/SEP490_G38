using MediatR;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    /// <summary>
    /// Gửi phiếu nháp. Đây là điểm không thể quay lại: hệ thống validate đầy đủ,
    /// tính BOQCheckStatus, sinh PO + GoodsReceipt và cộng tồn kho.
    /// Trả về message mô tả bước kế tiếp — nhánh trong/vượt định mức đi tới người duyệt khác nhau,
    /// chỉ handler mới biết kết quả tính BOQ nên message phải sinh ở đây.
    /// </summary>
    public record SubmitDirectPurchaseCommand(long DirectPurchaseId) : IRequest<string>;
}
