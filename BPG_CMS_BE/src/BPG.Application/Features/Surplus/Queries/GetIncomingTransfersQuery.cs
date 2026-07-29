using BPG.Application.Common.Models;
using BPG.Application.DTOs.Surplus;
using BPG.Application.IRepositories;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Surplus.Queries;

public record GetIncomingTransfersQuery(long ProjectId)
    : IRequest<ApiResponse<List<IncomingSurplusTransferDto>>>
{
    public Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        => Task.FromResult(ProjectId);
}

