using BPG.Application.Common.Models;
using BPG.Application.DTOs.Surplus;
using MediatR;

namespace BPG.Application.Features.Surplus.Queries;

/// <summary>
/// Lấy danh sách actions của một SurplusRequestItem: Return, Transfer, Liquidation.
/// </summary>
public record GetSurplusActionListQuery(long SurplusRequestItemId) : IRequest<ApiResponse<SurplusActionListDto>>;

public class SurplusActionListDto
{
    public long SurplusRequestItemId { get; set; }
    public List<SurplusReturnSupplierDto> Returns { get; set; } = new();
    public List<SurplusTransferDto> Transfers { get; set; } = new();
    public List<SurplusLiquidationDto> Liquidations { get; set; } = new();
}
