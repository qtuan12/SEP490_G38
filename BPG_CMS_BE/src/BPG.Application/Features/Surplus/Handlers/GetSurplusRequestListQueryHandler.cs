using BPG.Application.Common.Models;
using BPG.Application.DTOs.Surplus;
using BPG.Application.Features.Surplus.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Surplus.Handlers;

public class GetSurplusRequestListQueryHandler : IRequestHandler<GetSurplusRequestListQuery, PagedList<SurplusRequestDto>>
{
    private readonly IUnitOfWork _uow;

    public GetSurplusRequestListQueryHandler(IUnitOfWork uow) => _uow = uow;

    public async Task<PagedList<SurplusRequestDto>> Handle(GetSurplusRequestListQuery request, CancellationToken ct)
    {
        var query = _uow.Repository<SurplusRequest>().Query()
            .Include(sr => sr.Project)
            .Include(sr => sr.Items)
            .AsNoTracking();

        if (request.ProjectId.HasValue)
            query = query.Where(sr => sr.ProjectId == request.ProjectId.Value);

        if (!string.IsNullOrWhiteSpace(request.Status))
            query = query.Where(sr => sr.Status == request.Status);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = request.Search.Trim().ToLower();
            query = query.Where(sr => sr.Project.Name.ToLower().Contains(s) || (sr.Reason != null && sr.Reason.ToLower().Contains(s)));
        }

        var pagedEntities = await query
            .OrderByDescending(sr => sr.CreatedAt)
            .ToPagedListAsync(request, ct);

        // Fetch creator names
        var userIds = pagedEntities.Items.Where(x => x.CreatedBy.HasValue).Select(x => x.CreatedBy!.Value).Distinct().ToList();
        var userMap = userIds.Any()
            ? await _uow.Repository<User>().Query().Where(u => userIds.Contains(u.UserId))
                .ToDictionaryAsync(u => u.UserId, u => u.FullName, ct)
            : new Dictionary<long, string>();

        var dtos = pagedEntities.Items.Select(sr => new SurplusRequestDto
        {
            SurplusRequestId = sr.SurplusRequestId,
            ProjectId = sr.ProjectId,
            ProjectName = sr.Project.Name,
            Reason = sr.Reason,
            Status = sr.Status,
            CreatedAt = sr.CreatedAt,
            CreatedByName = sr.CreatedBy.HasValue && userMap.TryGetValue(sr.CreatedBy.Value, out var n) ? n : "N/A",
            TotalItems = sr.Items.Count,
            ProcessedItems = sr.Items.Count(i => i.Status == Domain.Constants.SurplusRequestItemStatus.Completed)
        }).ToList();

        return new PagedList<SurplusRequestDto>(dtos, pagedEntities.TotalCount, pagedEntities.PageNumber, pagedEntities.PageSize);
    }
}
