using BPG.Application.Common.Models;
using BPG.Application.Common.Attributes;
using BPG.Application.DTOs.Units;
using MediatR;

namespace BPG.Application.Features.Units.Queries;

// [Cacheable(DurationSeconds = 300)]
public class GetUnitsQuery : IRequest<PagedList<UnitDto>>
{
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? Search { get; set; }
    public string? SortBy { get; set; }
    public bool SortDescending { get; set; }
}
