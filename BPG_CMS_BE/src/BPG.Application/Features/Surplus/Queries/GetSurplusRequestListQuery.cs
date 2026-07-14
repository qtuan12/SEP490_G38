using BPG.Application.Common.Models;
using BPG.Application.DTOs.Surplus;
using MediatR;

namespace BPG.Application.Features.Surplus.Queries;

public class GetSurplusRequestListQuery : PaginationRequest, IRequest<PagedList<SurplusRequestDto>>
{
    public long? ProjectId { get; set; }
    public string? Status { get; set; }
}
