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
/// Káº¿ toÃ¡n xá»­ lÃ½ tráº£ NCC: nháº­p sá»‘ tiá»n thu há»“i vÃ  hoÃ n táº¥t action.
/// </summary>
public record CreateSurplusReturnActionCommand(
    long SurplusRequestItemId,
    long SupplierId,
    decimal ReturnQuantity,
    decimal? RefundAmount,
    string? Note,
    List<Microsoft.AspNetCore.Http.IFormFile>? Attachments
) : IRequest<ApiResponse<long>>
{
}

