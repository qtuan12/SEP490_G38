using BPG.Application.Common.Models;
using BPG.Application.DTOs.Inventory;
using MediatR;

namespace BPG.Application.Features.Inventory.Queries
{
    public class GetInventoryTransactionsQuery : PaginationRequest, IRequest<PagedList<InventoryTransactionDto>>
    {
        public long ProjectId { get; set; }
        public long? MaterialId { get; set; }
        public byte? TransactionType { get; set; }
    }
}
