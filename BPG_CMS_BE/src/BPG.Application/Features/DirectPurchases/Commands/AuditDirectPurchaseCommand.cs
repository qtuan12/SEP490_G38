using MediatR;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    public class AuditDirectPurchaseCommand : IRequest<bool>
    {
        public long DirectPurchaseId { get; set; }
        /// <summary>true = Đã kiểm toán/hoàn tiền, false = Từ chối kiểm toán.</summary>
        public bool Approve { get; set; }
        public string? AuditNote { get; set; }
    }
}
