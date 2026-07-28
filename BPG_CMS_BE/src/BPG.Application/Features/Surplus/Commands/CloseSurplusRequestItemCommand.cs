using BPG.Application.Common.Models;
using MediatR;

namespace BPG.Application.Features.Surplus.Commands;

public record CloseSurplusRequestItemCommand(
    long SurplusRequestItemId,
    string Reason) : IRequest<ApiResponse>;
