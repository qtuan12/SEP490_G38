using BPG.Domain.Constants;
using MediatR;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    /// <summary>
    /// Kế toán soát hóa đơn. Trả về message mô tả kết quả — phiếu trong định mức thì đây là
    /// bước cuối, phiếu vượt định mức còn phải trình Giám đốc, chỉ handler mới phân biệt được.
    /// </summary>
    public class AuditDirectPurchaseCommand : IRequest<string>
    {
        public long DirectPurchaseId { get; set; }
        /// <summary>true = Đã kiểm toán/hoàn tiền, false = Từ chối kiểm toán.</summary>
        public bool Approve { get; set; }
        public string? AuditNote { get; set; }
    }
}
