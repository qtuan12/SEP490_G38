using BPG.Application.DTOs.DirectPurchases;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.DirectPurchases.Queries
{
    public record GetDirectPurchaseByIdQuery(long DirectPurchaseId)
        : IRequest<DirectPurchaseDetailDto>
    {
        public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            var projectId = await unitOfWork.Repository<DirectPurchaseRequest>().Query()
                .Where(r => r.DirectPurchaseId == DirectPurchaseId)
                .Select(r => (long?)r.ProjectId)
                .FirstOrDefaultAsync(cancellationToken);

            return projectId ?? 0;
        }
    }
}

