using BPG.Application.Common.Models;
using BPG.Application.DTOs.Surplus;
using MediatR;

namespace BPG.Application.Features.Surplus.Queries;

public record GetSurplusRequestDetailQuery(long SurplusRequestId) : IRequest<ApiResponse<SurplusRequestDetailDto>>;
