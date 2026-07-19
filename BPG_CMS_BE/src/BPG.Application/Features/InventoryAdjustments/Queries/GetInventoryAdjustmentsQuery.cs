using BPG.Application.Common.Interfaces;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Inventory;
using BPG.Application.IRepositories;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.InventoryAdjustments.Queries
{
    public class GetInventoryAdjustmentsQuery : PaginationRequest, IRequest<PagedList<InventoryAdjustmentDto>>, IProjectRequirement
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

        public Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
            => Task.FromResult(ProjectId);
    }
}
