using BPG.Application.Common.Models;
using BPG.Domain.Constants;
using MediatR;

namespace BPG.Application.Features.GoodsReceipts.Commands;

public record CancelGoodsReceiptCommand(
    long ReceiptId
) : IRequest<ApiResponse<bool>>
{
}

