using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialReturns;
using BPG.Application.IRepositories;
using MediatR;

namespace BPG.Application.Features.MaterialReturns.Queries
{
    public class GetMaterialReturnsQuery : PaginationRequest, IRequest<PagedList<MaterialReturnDto>>
    {
        public long? ProjectId { get; set; }
        /// <summary>
        /// Lọc theo phiếu xuất kho gốc — dùng khi FE cần hiển thị lịch sử hoàn trả
        /// trong modal chi tiết phiếu xuất.
        /// </summary>
        public long? IssuanceId { get; set; }
    }
}
