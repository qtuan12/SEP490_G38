using BPG.Application.Common.Interfaces;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Inventory;
using BPG.Application.IRepositories;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Inventory.Queries
{
    public class GetInventoryTransactionsQuery : PaginationRequest, IRequest<PagedList<InventoryTransactionDto>>, IProjectRequirement
    {
        public long ProjectId { get; set; }
        public long? MaterialId { get; set; }
        public byte? TransactionType { get; set; }

        public Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
            => Task.FromResult(ProjectId);
    }
}
