using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Application.Features.MaterialIssuances.Queries;
using BPG.Application.DTOs.MaterialIssuances;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialIssuances.Handlers
{
    public class GetMaterialIssuancesQueryHandler : IRequestHandler<GetMaterialIssuancesQuery, PagedList<MaterialIssuanceDto>>
    {
        private readonly IUnitOfWork _uow;

        public GetMaterialIssuancesQueryHandler(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<PagedList<MaterialIssuanceDto>> Handle(GetMaterialIssuancesQuery request, CancellationToken cancellationToken)
        {
            var query = _uow.Repository<MaterialIssuance>().Query()
                .Include(mi => mi.Task)
                    .ThenInclude(t => t.Phase)
                .Include(mi => mi.Items)
                .AsQueryable();

            if (request.ProjectId.HasValue)
            {
                query = query.Where(mi => mi.Task.Phase.ProjectId == request.ProjectId.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var search = request.Search.Trim().ToLower();
                query = query.Where(mi => mi.Task.Name.ToLower().Contains(search) 
                                       || mi.Purpose.ToLower().Contains(search));
            }

            var pagedEntities = await query
                .OrderByDescending(mi => mi.CreatedAt)
                .ToPagedListAsync(request, cancellationToken);

            var userIds = pagedEntities.Items.Where(mi => mi.CreatedBy.HasValue).Select(mi => mi.CreatedBy!.Value).Distinct().ToList();
            var userMap = new Dictionary<long, string>();
            if (userIds.Any())
            {
                userMap = await _uow.Repository<User>().Query()
                    .Where(u => userIds.Contains(u.UserId))
                    .ToDictionaryAsync(u => u.UserId, u => u.FullName, cancellationToken);
            }

            var dtos = pagedEntities.Items.Select(mi => new MaterialIssuanceDto
            {
                MaterialIssuanceId = mi.MaterialIssuanceId,
                IssuanceNo = mi.IssuanceNo,
                TaskId = mi.TaskId,
                TaskName = mi.Task?.Name ?? string.Empty,
                Purpose = mi.Purpose,
                TotalItems = mi.Items.Count,
                CreatedAt = mi.CreatedAt,
                CreatedByName = mi.CreatedBy.HasValue && userMap.TryGetValue(mi.CreatedBy.Value, out var name) ? name : "N/A"
            }).ToList();

            return new PagedList<MaterialIssuanceDto>(dtos, pagedEntities.TotalCount, pagedEntities.PageNumber, pagedEntities.PageSize);
        }
    }
}
