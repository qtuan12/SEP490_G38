using BPG.Application.Common.Models;
using BPG.Application.DTOs.PurchaseOrders;
using BPG.Application.Common.Interfaces;
using BPG.Application.IRepositories;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.PurchaseOrders.Queries
{
    public class GetPurchaseOrdersQuery : PaginationRequest, IRequest<PagedList<PurchaseOrderDto>>, IProjectScopedListRequest
    {
        public long? ProjectId { get; set; }
        public string? Status { get; set; }

        // Search (kế thừa từ PaginationRequest): tìm theo số đơn hàng hoặc tên nhà cung cấp

        public DateOnly? OrderDateFrom { get; set; }
        public DateOnly? OrderDateTo { get; set; }

        // Không truyền ProjectId → xem danh sách PO của TẤT CẢ dự án (chỉ role full-access
        // trong ProjectAuthorizationBehavior mới được phép xem global, role khác vẫn bị chặn).
        public Task<long?> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            return Task.FromResult(ProjectId);
        }
    }
}
