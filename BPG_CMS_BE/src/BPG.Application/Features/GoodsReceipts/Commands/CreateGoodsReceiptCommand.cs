using BPG.Application.Common.Models;
using BPG.Application.Common.Authorization;
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
) : IRequest<ApiResponse<long>>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.PurchaseOrder(POId);
    public string RequiredPermission => ProjectPermission.ExecutionManage;
}

public record CreateGoodsReceiptItemDto(
    long MaterialId,
    int UnitId,
    decimal Quantity
);
