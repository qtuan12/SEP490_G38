using BPG.Application.Common.Models;
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;
using MediatR;

namespace BPG.Application.Features.GoodsReceipts.Commands;

public record CancelGoodsReceiptCommand(
    long ReceiptId
) : IRequest<ApiResponse<bool>>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.GoodsReceipt(ReceiptId);
    public string RequiredPermission => ProjectPermission.InventoryManage;
}
