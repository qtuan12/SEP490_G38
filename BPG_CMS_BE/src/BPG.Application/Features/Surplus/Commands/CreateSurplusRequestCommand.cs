using BPG.Application.Common.Models;
using MediatR;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;

namespace BPG.Application.Features.Surplus.Commands;

/// <summary>
/// Leader táº¡o Ä‘á» xuáº¥t xá»­ lÃ½ váº­t tÆ° thá»«a cho má»™t dá»± Ã¡n.
/// Business rule: há»‡ thá»‘ng auto táº¡o batch vá»›i toÃ n bá»™ tá»“n kho hiá»‡n táº¡i cá»§a dá»± Ã¡n.
/// </summary>
public record CreateSurplusRequestCommand(long ProjectId, string? Reason)
    : IRequest<ApiResponse<long>>
{
}

