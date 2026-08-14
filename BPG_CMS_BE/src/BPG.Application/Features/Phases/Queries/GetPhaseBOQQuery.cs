using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BPG.Application.DTOs.Phases;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Phases.Queries
{
    public record GetPhaseBOQQuery(long PhaseId) : IRequest<List<PhaseBOQItemDto>>
    {
        public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            var projectId = await unitOfWork.Repository<Phase>().Query()
                .Where(p => p.PhaseId == PhaseId)
                .Select(p => p.ProjectId)
                .FirstOrDefaultAsync(cancellationToken);

            if (projectId == 0)
                throw new NotFoundException(nameof(Phase), PhaseId);

            return projectId;
        }
    }

}

