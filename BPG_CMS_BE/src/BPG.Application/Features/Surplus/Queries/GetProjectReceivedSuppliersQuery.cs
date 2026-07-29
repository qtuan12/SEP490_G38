using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using MediatR;

namespace BPG.Application.Features.Surplus.Queries;

public sealed record GetProjectReceivedSuppliersQuery(long ProjectId)
    : IRequest<ApiResponse<IReadOnlyList<SurplusMaterialSupplier>>>
{
    public Task<long> GetProjectIdAsync(
        IUnitOfWork unitOfWork,
        CancellationToken cancellationToken)
        => Task.FromResult(ProjectId);
}

