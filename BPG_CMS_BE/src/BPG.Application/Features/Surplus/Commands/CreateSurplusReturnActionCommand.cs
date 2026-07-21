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
/// Kế toán xử lý trả NCC: nhập số tiền thu hồi và hoàn tất action.
/// </summary>
public record CreateSurplusReturnActionCommand(
    long SurplusRequestItemId,
    long? SupplierId,
    decimal ReturnQuantity,
    decimal? RefundAmount,
    string? Note,
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
