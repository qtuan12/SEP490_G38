using BPG.Application.Common.Models;
using MediatR;

namespace BPG.Application.Features.Surplus.Commands;

/// <summary>
/// Kế toán xử lý trả NCC: nhập số tiền thu hồi và hoàn tất action.
/// </summary>
public record CreateSurplusReturnActionCommand(
    long SurplusRequestItemId,
    long? SupplierId,
    decimal ReturnQuantity,
    decimal? RefundAmount,
    string? Note,
    List<Microsoft.AspNetCore.Http.IFormFile>? Attachments
) : IRequest<ApiResponse<long>>;
