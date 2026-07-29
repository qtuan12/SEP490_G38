using BPG.Domain.Constants;
using MediatR;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    public class AuditDirectPurchaseCommand : IRequest<bool>
    {
        public long DirectPurchaseId { get; set; }
        /// <summary>true = ÄÃ£ kiá»ƒm toÃ¡n/hoÃ n tiá»n, false = Tá»« chá»‘i kiá»ƒm toÃ¡n.</summary>
        public bool Approve { get; set; }
        public string? AuditNote { get; set; }
    }
}

