using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialIssuances;
using BPG.Application.Common.Interfaces;
using BPG.Application.IRepositories;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialIssuances.Queries
{
    public class GetMaterialIssuancesQuery : PaginationRequest, IRequest<PagedList<MaterialIssuanceDto>>, IProjectRequirement
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
