using BPG.Application.Common.Models;
using BPG.Domain.Constants;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.GoodsReceipts.Commands;

public record CreateGoodsReceiptCommand(
    long POId,
    string? DelivererInfo,
    string? DeliveryDocNo,
    List<CreateGoodsReceiptItemDto> Items,
    List<string>? Images = null
) : IRequest<ApiResponse<long>>
{
}

public record CreateGoodsReceiptItemDto(
    long MaterialId,
    int UnitId,
    decimal Quantity
);

