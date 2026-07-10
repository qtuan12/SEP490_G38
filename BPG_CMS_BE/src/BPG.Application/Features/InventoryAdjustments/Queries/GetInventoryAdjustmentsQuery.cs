using BPG.Application.Common.Models;
using BPG.Application.DTOs.Inventory;
using MediatR;

namespace BPG.Application.Features.InventoryAdjustments.Queries
{
    public class GetInventoryAdjustmentsQuery : PaginationRequest, IRequest<PagedList<InventoryAdjustmentDto>>
    {
        public long ProjectId { get; set; }
        public string? AdjustmentType { get; set; }
        public string? Status { get; set; }
        public string? SearchTerm { get; set; }
        
        public GetInventoryAdjustmentsQuery() {}

        public GetInventoryAdjustmentsQuery(long projectId)
        {
            ProjectId = projectId;
        }
    }
}
