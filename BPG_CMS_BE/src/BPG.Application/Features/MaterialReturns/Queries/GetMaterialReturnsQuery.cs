using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialReturns;
using BPG.Application.Common.Interfaces;
using BPG.Application.IRepositories;
using BPG.Domain.Exceptions;
using MediatR;
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

        public Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            if (ProjectId == null)
                throw new NotFoundException("ProjectId");
            return Task.FromResult(ProjectId.Value);
        }
    }
}
