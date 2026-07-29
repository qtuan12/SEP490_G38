using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;
using MediatR;

namespace BPG.Application.Features.PurchaseOrders.Commands
{
    public class CancelPurchaseOrderCommand : IRequest<bool>, IProjectResourceRequirement
    {
        public long POId { get; init; }
        public ProjectResource ProjectResource => ProjectResource.PurchaseOrder(POId);
        public string RequiredPermission => ProjectPermission.AccountingManage;
        public string Reason { get; init; } = string.Empty;
    }
}
