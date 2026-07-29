using BPG.Application.DTOs.PurchaseOrders;
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;
using MediatR;

namespace BPG.Application.Features.PurchaseOrders.Commands
{
    public class CreatePurchaseOrderCommand : IRequest<long>, IProjectResourceRequirement
    {
        public string? PONumber { get; init; }
        public DateTime OrderDate { get; init; }
        public long? SupplierId { get; init; }
        public long ProjectId { get; init; }
        public ProjectResource ProjectResource => ProjectResource.Project(ProjectId);
        public string RequiredPermission => ProjectPermission.AccountingManage;
        public DateOnly? ExpectedDeliveryDate { get; init; }
        public string? DeliveryAddress { get; init; }
        public string? Notes { get; init; }
        public long RequestId { get; init; }
        public List<CreatePOItemDto> Items { get; init; } = new();
    }
}
