using BPG.Domain.Constants;
using MediatR;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    /// <summary>
    /// Kế toán soát hóa đơn. Đây là bước sàng lọc trước Giám đốc, không bao giờ là bước cuối.
    /// Trả về message mô tả kết quả — soát đạt thì phiếu chuyển sang chờ Giám đốc duyệt chi.
    /// </summary>
    public class AuditDirectPurchaseCommand : IRequest<string>
    {
        public long DirectPurchaseId { get; set; }
        /// <summary>true = Đã kiểm toán/hoàn tiền, false = Từ chối kiểm toán.</summary>
        public bool Approve { get; set; }
        public string? AuditNote { get; set; }
    }
}
