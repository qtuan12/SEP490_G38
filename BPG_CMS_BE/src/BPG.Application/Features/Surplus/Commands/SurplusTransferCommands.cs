using BPG.Application.Common.Models;
using MediatR;
using Microsoft.AspNetCore.Http;
using BPG.Application.Common.Interfaces;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using BPG.Domain.Exceptions;

namespace BPG.Application.Features.Surplus.Commands;

/// <summary>
/// Leader tạo action chuyển kho surplus sang dự án nhận.
/// Sau khi tạo, TPKT sẽ duyệt (ReviewSurplusTransferCommand).
/// </summary>
public record CreateSurplusTransferActionCommand(
    long SurplusRequestItemId,
    long ToProjectId,
    decimal TransferQuantity
) : IRequest<ApiResponse<long>>, IRequireProjectLeader
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

/// <summary>
/// TPKT duyệt hoặc từ chối đề xuất chuyển kho.
/// </summary>
public record ReviewSurplusTransferCommand(
    long SurplusTransferId,
    bool IsApproved
) : IRequest<ApiResponse>, IRequireTechnicalManager
{
    public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
    {
        var transfer = await unitOfWork.Repository<SurplusTransfer>().Query()
            .FirstOrDefaultAsync(t => t.SurplusTransferId == SurplusTransferId, cancellationToken);
        if (transfer == null) throw new NotFoundException("SurplusTransfer", SurplusTransferId);
        return transfer.FromProjectId;
    }
}

/// <summary>
/// Bên gửi xác nhận đã vận chuyển (Dispatched).
/// </summary>
public record DispatchSurplusTransferCommand(long SurplusTransferId, List<IFormFile>? Attachments) : IRequest<ApiResponse>, IRequireProjectLeader
{
    public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
    {
        var transfer = await unitOfWork.Repository<SurplusTransfer>().Query()
            .FirstOrDefaultAsync(t => t.SurplusTransferId == SurplusTransferId, cancellationToken);
        if (transfer == null) throw new NotFoundException("SurplusTransfer", SurplusTransferId);
        return transfer.FromProjectId;
    }
}

/// <summary>
/// Bên nhận xác nhận đã nhận hàng (Received) → cập nhật tồn kho 2 chiều.
/// </summary>
public record ReceiveSurplusTransferCommand(long SurplusTransferId, List<IFormFile>? Attachments) : IRequest<ApiResponse>, IRequireProjectLeader
{
    public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
    {
        var transfer = await unitOfWork.Repository<SurplusTransfer>().Query()
            .FirstOrDefaultAsync(t => t.SurplusTransferId == SurplusTransferId, cancellationToken);
        if (transfer == null) throw new NotFoundException("SurplusTransfer", SurplusTransferId);
        return transfer.ToProjectId;
    }
}
