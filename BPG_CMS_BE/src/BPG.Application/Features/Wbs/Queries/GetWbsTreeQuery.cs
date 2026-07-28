using BPG.Application.DTOs.Wbs;
using BPG.Application.Common.Interfaces;
using BPG.Application.IRepositories;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Wbs.Queries;

public record GetWbsTreeQuery(long ProjectId) : IRequest<WbsTreeDto>, IProjectRequirement
{
    public Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        => Task.FromResult(ProjectId);
}
