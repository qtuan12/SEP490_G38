using BPG.Application.Common.Models;
using MediatR;
using Microsoft.AspNetCore.Http;

namespace BPG.Application.Features.Surplus.Commands;

/// <summary>
/// Leader tạo action chuyển kho surplus sang dự án nhận.
/// Sau khi tạo, TPKT sẽ duyệt (ReviewSurplusTransferCommand).
/// </summary>
public record CreateSurplusTransferActionCommand(
    long SurplusRequestItemId,
    long ToProjectId,
    decimal TransferQuantity
) : IRequest<ApiResponse<long>>;

/// <summary>
/// TPKT duyệt hoặc từ chối đề xuất chuyển kho.
/// </summary>
public record ReviewSurplusTransferCommand(
    long SurplusTransferId,
    bool IsApproved
) : IRequest<ApiResponse>;

/// <summary>
/// Bên gửi xác nhận đã vận chuyển (Dispatched).
/// </summary>
public record DispatchSurplusTransferCommand(long SurplusTransferId, List<IFormFile>? Attachments) : IRequest<ApiResponse>;

/// <summary>
/// Bên nhận xác nhận đã nhận hàng (Received) → cập nhật tồn kho 2 chiều.
/// </summary>
public record ReceiveSurplusTransferCommand(long SurplusTransferId, List<IFormFile>? Attachments) : IRequest<ApiResponse>;
