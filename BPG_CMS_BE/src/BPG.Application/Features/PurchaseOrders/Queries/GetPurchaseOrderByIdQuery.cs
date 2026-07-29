using BPG.Application.Common.Models;
using BPG.Application.DTOs.PurchaseOrders;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PurchaseOrders.Queries
{
    public record GetPurchaseOrderByIdQuery(long POId) : IRequest<ApiResponse<PurchaseOrderDetailDto>>
    {
        public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            var projectId = await unitOfWork.Repository<PurchaseOrder>().Query()
                .Where(po => po.POId == POId)
                .Select(po => (long?)po.ProjectId)
                .FirstOrDefaultAsync(cancellationToken);

            if (projectId == null)
                throw new NotFoundException(nameof(PurchaseOrder), POId);

            return projectId.Value;
        }
    }
}

