using BPG.Application.Common.Models;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.GoodsReceipts.Commands;

public record PatchGoodsReceiptMetadataCommand(
    long ReceiptId,
    string? DelivererInfo,
    string? DeliveryDocNo,
    List<string>? Images = null
) : IRequest<ApiResponse<bool>>;
