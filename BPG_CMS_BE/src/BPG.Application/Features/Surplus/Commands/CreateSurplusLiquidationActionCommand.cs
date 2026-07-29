using BPG.Application.Common.Models;
using MediatR;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using BPG.Domain.Exceptions;
using BPG.Domain.Constants;

namespace BPG.Application.Features.Surplus.Commands;

/// <summary>
/// Káº¿ toÃ¡n xá»­ lÃ½ thanh lÃ½ váº­t tÆ° thá»«a: nháº­p giÃ¡ trá»‹ thu há»“i vÃ  hoÃ n táº¥t.
/// </summary>
public record CreateSurplusLiquidationActionCommand(
    long SurplusRequestItemId,
    string BuyerName,
    decimal LiquidationQuantity,
    decimal TotalAmount,
    List<Microsoft.AspNetCore.Http.IFormFile>? Attachments
) : IRequest<ApiResponse<long>>
{
}

