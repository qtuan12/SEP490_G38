using BPG.Application.Common.Models;
using MediatR;
using BPG.Application.Common.Interfaces;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using BPG.Domain.Exceptions;
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;

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
) : IRequest<ApiResponse<long>>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.SurplusRequestItem(SurplusRequestItemId);
    public string RequiredPermission => ProjectPermission.AccountingManage;
}
