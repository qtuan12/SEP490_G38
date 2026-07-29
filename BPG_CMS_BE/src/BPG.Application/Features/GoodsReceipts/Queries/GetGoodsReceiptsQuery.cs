using BPG.Application.Common.Models;
using BPG.Application.DTOs.GoodsReceipts;
using BPG.Application.IRepositories;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.GoodsReceipts.Queries
{
    public class GetGoodsReceiptsQuery : PaginationRequest, IRequest<PagedList<GoodsReceiptDto>>
    {
        public long? ProjectId { get; set; }

        public Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            if (ProjectId == null)
                throw new NotFoundException("ProjectId");
            return Task.FromResult(ProjectId.Value);
        }
    }
}

