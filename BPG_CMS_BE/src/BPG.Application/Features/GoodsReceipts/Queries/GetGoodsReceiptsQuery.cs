using BPG.Application.Common.Models;
using BPG.Application.DTOs.GoodsReceipts;
using MediatR;

namespace BPG.Application.Features.GoodsReceipts.Queries
{
    public class GetGoodsReceiptsQuery : PaginationRequest, IRequest<PagedList<GoodsReceiptDto>>
    {
        public long? ProjectId { get; set; }
    }
}
