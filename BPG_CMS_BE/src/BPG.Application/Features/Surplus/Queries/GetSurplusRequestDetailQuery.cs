using BPG.Application.Common.Models;
using BPG.Application.DTOs.Surplus;
using BPG.Application.Common.Interfaces;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Surplus.Queries;

public record GetSurplusRequestDetailQuery(long SurplusRequestId) : IRequest<ApiResponse<SurplusRequestDetailDto>>, IProjectRequirement
{
    public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
    {
        var projectId = await unitOfWork.Repository<SurplusRequest>().Query()
            .Where(s => s.SurplusRequestId == SurplusRequestId)
            .Select(s => s.ProjectId)
            .FirstOrDefaultAsync(cancellationToken);

        if (projectId == 0)
            throw new NotFoundException(nameof(SurplusRequest), SurplusRequestId);

        return projectId;
    }
}
