using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialReturns;
using BPG.Application.Common.Interfaces;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialReturns.Queries
{
    public class GetMaterialReturnsQuery : PaginationRequest, IRequest<PagedList<MaterialReturnDto>>, IProjectRequirement
    {
        public long? ProjectId { get; set; }
        /// <summary>
        /// Lọc theo phiếu xuất kho gốc — dùng khi FE cần hiển thị lịch sử hoàn trả
        /// trong modal chi tiết phiếu xuất.
        /// </summary>
        public long? IssuanceId { get; set; }

        public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            if (ProjectId != null)
                return ProjectId.Value;

            // FE xem lịch sử hoàn trả của 1 phiếu xuất (modal chi tiết phiếu xuất)
            // mà không truyền ProjectId → suy luận ProjectId từ graph Issuance → Task → Phase.
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
