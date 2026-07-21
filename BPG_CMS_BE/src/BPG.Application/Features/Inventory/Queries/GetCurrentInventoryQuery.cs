using BPG.Application.Common.Interfaces;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Inventory;
using BPG.Application.IRepositories;
using MediatR;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Inventory.Queries
{
    public record GetCurrentInventoryQuery(long ProjectId)
        : IRequest<ApiResponse<List<CurrentInventoryDto>>>, IProjectRequirement
    {
        public Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
            => Task.FromResult(ProjectId);
    }
}
