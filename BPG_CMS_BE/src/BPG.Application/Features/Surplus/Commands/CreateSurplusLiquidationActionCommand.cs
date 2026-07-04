using BPG.Application.Common.Models;
using MediatR;

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
) : IRequest<ApiResponse<long>>;
