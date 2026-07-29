using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialReturns;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialReturns.Queries
{
    public class GetMaterialReturnsQuery : PaginationRequest, IRequest<PagedList<MaterialReturnDto>>
    {
        public long? ProjectId { get; set; }
        /// <summary>
        /// Lá»c theo phiáº¿u xuáº¥t kho gá»‘c â€” dÃ¹ng khi FE cáº§n hiá»ƒn thá»‹ lá»‹ch sá»­ hoÃ n tráº£
        /// trong modal chi tiáº¿t phiáº¿u xuáº¥t.
        /// </summary>
        public long? IssuanceId { get; set; }

        public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            if (ProjectId != null)
                return ProjectId.Value;

            // FE xem lá»‹ch sá»­ hoÃ n tráº£ cá»§a 1 phiáº¿u xuáº¥t (modal chi tiáº¿t phiáº¿u xuáº¥t)
            // mÃ  khÃ´ng truyá»n ProjectId â†’ suy luáº­n ProjectId tá»« graph Issuance â†’ Task â†’ Phase.
            if (IssuanceId == null)
                throw new NotFoundException("ProjectId");

            var issuance = await unitOfWork.Repository<MaterialIssuance>()
                .Query()
                .Include(i => i.Task)
                .ThenInclude(t => t.Phase)
                .FirstOrDefaultAsync(i => i.MaterialIssuanceId == IssuanceId.Value, cancellationToken);

            if (issuance?.Task?.Phase == null)
                throw new NotFoundException("ProjectId");

            return issuance.Task.Phase.ProjectId;
        }
    }
}

