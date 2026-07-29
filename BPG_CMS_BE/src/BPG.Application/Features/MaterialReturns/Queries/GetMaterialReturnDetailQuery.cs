using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialReturns;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.MaterialReturns.Queries
{
    public record GetMaterialReturnDetailQuery(long ReturnId) : IRequest<ApiResponse<MaterialReturnDetailDto>>
    {
        public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            var projectId = await unitOfWork.Repository<MaterialReturn>().Query()
                .Where(r => r.MaterialReturnId == ReturnId)
                .Select(r => r.OriginalIssuance.Task.Phase.ProjectId)
                .FirstOrDefaultAsync(cancellationToken);

            if (projectId == 0)
                throw new NotFoundException(nameof(MaterialReturn), ReturnId);

            return projectId;
        }
    }
}

