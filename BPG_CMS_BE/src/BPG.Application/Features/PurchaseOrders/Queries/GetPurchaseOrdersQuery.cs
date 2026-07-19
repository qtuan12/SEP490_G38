using BPG.Application.Common.Models;
using BPG.Application.DTOs.PurchaseOrders;
using BPG.Application.Common.Interfaces;
using BPG.Application.IRepositories;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.PurchaseOrders.Queries
{
    public class GetPurchaseOrdersQuery : PaginationRequest, IRequest<PagedList<PurchaseOrderDto>>, IProjectRequirement
    {
        public long? ProjectId { get; set; }
        public string? Status { get; set; }
        public string? PONumber { get; set; }

        public Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            if (ProjectId == null)
                throw new NotFoundException("ProjectId");
            return Task.FromResult(ProjectId.Value);
        }
    }
}
