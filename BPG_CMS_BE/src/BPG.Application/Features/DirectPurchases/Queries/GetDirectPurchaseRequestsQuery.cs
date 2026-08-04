using BPG.Application.Common.Models;
using BPG.Application.DTOs.DirectPurchases;
using BPG.Application.IRepositories;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.DirectPurchases.Queries
{
    public class GetDirectPurchaseRequestsQuery : PaginationRequest, IRequest<PagedList<DirectPurchaseRequestDto>>
    {
        public long? ProjectId { get; set; }
        public string? Status { get; set; }
        public string? AuditStatus { get; set; }
        /// <summary>Lọc theo WithinBOQ | OverBOQ.</summary>
        public string? BOQCheckStatus { get; set; }
        public long? RequestedBy { get; set; }
        public string? SearchTerm { get; set; }

        public Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            if (ProjectId == null)
                throw new NotFoundException("Thiếu mã dự án khi lấy danh sách phiếu mua trực tiếp.");
            return Task.FromResult(ProjectId.Value);
        }
    }
}

