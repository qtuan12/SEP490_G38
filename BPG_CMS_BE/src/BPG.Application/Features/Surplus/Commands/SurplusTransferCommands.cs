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
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;

namespace BPG.Application.Features.Surplus.Commands;

/// <summary>
/// Leader tạo action chuyển kho surplus sang dự án nhận.
/// Sau khi tạo, TPKT sẽ duyệt (ReviewSurplusTransferCommand).
/// </summary>
public record CreateSurplusTransferActionCommand(
    long SurplusRequestItemId,
    long ToProjectId,
    decimal TransferQuantity
) : IRequest<ApiResponse<long>>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.SurplusRequestItem(SurplusRequestItemId);
    public string RequiredPermission => ProjectPermission.ExecutionManage;
}

/// <summary>
/// TPKT duyệt hoặc từ chối đề xuất chuyển kho.
/// </summary>
public record ReviewSurplusTransferCommand(
    long SurplusTransferId,
    bool IsApproved
) : IRequest<ApiResponse>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.SurplusTransferSource(SurplusTransferId);
    public string RequiredPermission => ProjectPermission.TechnicalManage;
}

/// <summary>
/// Bên gửi xác nhận đã vận chuyển (Dispatched).
/// </summary>
public record DispatchSurplusTransferCommand(long SurplusTransferId, List<IFormFile>? Attachments)
    : IRequest<ApiResponse>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.SurplusTransferSource(SurplusTransferId);
    public string RequiredPermission => ProjectPermission.ExecutionManage;
}

/// <summary>
/// Bên nhận xác nhận đã nhận hàng (Received) → cập nhật tồn kho 2 chiều.
/// </summary>
public record ReceiveSurplusTransferCommand(long SurplusTransferId, List<IFormFile>? Attachments)
    : IRequest<ApiResponse>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.SurplusTransferDestination(SurplusTransferId);
    public string RequiredPermission => ProjectPermission.ExecutionManage;
}
