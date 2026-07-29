using BPG.Application.Common.Models;
using MediatR;
using Microsoft.AspNetCore.Http;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using BPG.Domain.Exceptions;
using BPG.Domain.Constants;

namespace BPG.Application.Features.Surplus.Commands;

/// <summary>
/// Leader táº¡o action chuyá»ƒn kho surplus sang dá»± Ã¡n nháº­n.
/// Sau khi táº¡o, TPKT sáº½ duyá»‡t (ReviewSurplusTransferCommand).
/// </summary>
public record CreateSurplusTransferActionCommand(
    long SurplusRequestItemId,
    long ToProjectId,
    decimal TransferQuantity
) : IRequest<ApiResponse<long>>
{
}

/// <summary>
/// TPKT duyá»‡t hoáº·c tá»« chá»‘i Ä‘á» xuáº¥t chuyá»ƒn kho.
/// </summary>
public record ReviewSurplusTransferCommand(
    long SurplusTransferId,
    bool IsApproved
) : IRequest<ApiResponse>
{
}

/// <summary>
/// BÃªn gá»­i xÃ¡c nháº­n Ä‘Ã£ váº­n chuyá»ƒn (Dispatched).
/// </summary>
public record DispatchSurplusTransferCommand(long SurplusTransferId, List<IFormFile>? Attachments)
    : IRequest<ApiResponse>
{
}

/// <summary>
/// BÃªn nháº­n xÃ¡c nháº­n Ä‘Ã£ nháº­n hÃ ng (Received) â†’ cáº­p nháº­t tá»“n kho 2 chiá»u.
/// </summary>
public record ReceiveSurplusTransferCommand(long SurplusTransferId, List<IFormFile>? Attachments)
    : IRequest<ApiResponse>
{
}

