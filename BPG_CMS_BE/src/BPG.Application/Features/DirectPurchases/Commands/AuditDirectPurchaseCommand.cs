using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;
using MediatR;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    public class AuditDirectPurchaseCommand : IRequest<bool>, IProjectResourceRequirement
    {
        public long DirectPurchaseId { get; set; }
        public ProjectResource ProjectResource => ProjectResource.DirectPurchase(DirectPurchaseId);
        public string RequiredPermission => ProjectPermission.AccountingManage;
        /// <summary>true = Đã kiểm toán/hoàn tiền, false = Từ chối kiểm toán.</summary>
        public bool Approve { get; set; }
        public string? AuditNote { get; set; }
    }
}
