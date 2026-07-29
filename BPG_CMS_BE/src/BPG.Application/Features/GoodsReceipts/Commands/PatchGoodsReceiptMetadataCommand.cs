using BPG.Application.Common.Models;
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.GoodsReceipts.Commands;

public record PatchGoodsReceiptMetadataCommand(
    long ReceiptId,
    string? DelivererInfo,
    string? DeliveryDocNo,
    List<string>? Images = null
) : IRequest<ApiResponse<bool>>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.GoodsReceipt(ReceiptId);
    public string RequiredPermission => ProjectPermission.InventoryManage;
}
