using BPG.Application.Common.Models;
using BPG.Application.DTOs.PurchaseOrders;
using BPG.Application.Common.Interfaces;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PurchaseOrders.Queries
{
    public record GetPurchaseOrderByIdQuery(long POId) : IRequest<ApiResponse<PurchaseOrderDetailDto>>, IProjectRequirement
    {
        public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            // ProjectId có thể null trên chính PO (đơn tạo qua yêu cầu vật tư không gán thẳng dự án) —
            // khi đó phải suy luận qua Request → Phase → ProjectId, giống logic ở GetPurchaseOrderByIdQueryHandler
            // và GetPurchaseOrdersQueryHandler, tránh báo "không tồn tại" nhầm cho PO thật sự có tồn tại.
            var result = await unitOfWork.Repository<PurchaseOrder>().Query()
                .Where(po => po.POId == POId)
                .Select(po => new
                {
                    po.ProjectId,
                    RequestProjectId = po.Request != null ? (long?)po.Request.Phase.ProjectId : null
                })
                .FirstOrDefaultAsync(cancellationToken);

            var projectId = result?.ProjectId ?? result?.RequestProjectId;
            if (projectId == null)
                throw new NotFoundException(nameof(PurchaseOrder), POId);

            return projectId.Value;
        }
    }
}
