using BPG.Application.Common.Models;
using BPG.Application.Features.Surplus.DTOs;
using MediatR;

namespace BPG.Application.Features.Surplus.Queries;

public record GetIncomingTransfersQuery(long ProjectId) : IRequest<ApiResponse<List<IncomingSurplusTransferDto>>>;
