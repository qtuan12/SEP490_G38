using BPG.Application.Common.Interfaces;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.PurchaseOrders;
using BPG.Application.IRepositories;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.PurchaseOrders.Queries
{
    public record GetApprovedRequestsForPOQuery(long ProjectId)
        : IRequest<ApiResponse<List<ApprovedRequestForPODto>>>, IProjectRequirement
    {
        public Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
            => Task.FromResult(ProjectId);
    }
}
