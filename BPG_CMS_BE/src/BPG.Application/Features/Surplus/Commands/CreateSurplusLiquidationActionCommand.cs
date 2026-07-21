using BPG.Application.Common.Models;
using MediatR;
using BPG.Application.Common.Interfaces;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using BPG.Domain.Exceptions;

namespace BPG.Application.Features.Surplus.Commands;

/// <summary>
/// Kế toán xử lý thanh lý vật tư thừa: nhập giá trị thu hồi và hoàn tất.
/// </summary>
public record CreateSurplusLiquidationActionCommand(
    long SurplusRequestItemId,
    string BuyerName,
    decimal LiquidationQuantity,
    decimal TotalAmount,
    List<Microsoft.AspNetCore.Http.IFormFile>? Attachments
) : IRequest<ApiResponse<long>>, IRequireAccountant
{
    public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
    {
        var item = await unitOfWork.Repository<SurplusRequestItem>().Query()
            .Include(i => i.SurplusRequest)
            .FirstOrDefaultAsync(i => i.SurplusRequestItemId == SurplusRequestItemId, cancellationToken);
        if (item == null) throw new NotFoundException("SurplusRequestItem", SurplusRequestItemId);
        return item.SurplusRequest.ProjectId;
    }
}
