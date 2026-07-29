using BPG.Application.Common.Models;
using BPG.Application.DTOs.Surplus;
using BPG.Application.IRepositories;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Surplus.Queries;

public class GetSurplusRequestListQuery : PaginationRequest, IRequest<PagedList<SurplusRequestDto>>
{
    public long? ProjectId { get; set; }
    public string? Status { get; set; }

    public Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
    {
        if (ProjectId == null)
            throw new NotFoundException("ProjectId");
        return Task.FromResult(ProjectId.Value);
    }
}

