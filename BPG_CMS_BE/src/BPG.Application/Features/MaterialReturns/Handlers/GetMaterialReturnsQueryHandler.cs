using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialReturns;
using BPG.Application.Features.MaterialReturns.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialReturns.Handlers
{
    public class GetMaterialReturnsQueryHandler : IRequestHandler<GetMaterialReturnsQuery, PagedList<MaterialReturnDto>>
    {
        private readonly IUnitOfWork _uow;

        public GetMaterialReturnsQueryHandler(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<PagedList<MaterialReturnDto>> Handle(GetMaterialReturnsQuery request, CancellationToken cancellationToken)
        {
            var query = _uow.Repository<MaterialReturn>().Query()
                .Include(r => r.OriginalIssuance)
                    .ThenInclude(i => i.Task)
                        .ThenInclude(t => t.Phase)
                .Include(r => r.Items)
                    .ThenInclude(i => i.Material)
                .Include(r => r.Items)
                    .ThenInclude(i => i.Unit)
                .AsSplitQuery()
                .AsNoTracking()
                .AsQueryable();

            if (request.IssuanceId.HasValue)
            {
                query = query.Where(r => r.OriginalIssuanceId == request.IssuanceId.Value);
            }
            else if (request.ProjectId.HasValue)
            {
                query = query.Where(r => r.OriginalIssuance.Task.Phase.ProjectId == request.ProjectId.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var search = request.Search.Trim().ToLower();
                query = query.Where(r => r.ReturnNo.ToLower().Contains(search)
                                      || r.Reason.ToLower().Contains(search)
                                      || r.OriginalIssuance.IssuanceNo.ToLower().Contains(search));
            }

            var pagedEntities = await query
                .OrderByDescending(r => r.CreatedAt)
                .ToPagedListAsync(request, cancellationToken);

            var userIds = pagedEntities.Items
                .Where(r => r.CreatedBy.HasValue)
                .Select(r => r.CreatedBy!.Value)
                .Distinct()
                .ToList();

            var userMap = new Dictionary<long, string>();
            if (userIds.Any())
            {
                userMap = await _uow.Repository<User>().Query()
                    .Where(u => userIds.Contains(u.UserId))
                    .ToDictionaryAsync(u => u.UserId, u => u.FullName, cancellationToken);
            }

            var dtos = pagedEntities.Items.Select(r => new MaterialReturnDto
            {
                MaterialReturnId = r.MaterialReturnId,
                ReturnNo = r.ReturnNo,
                OriginalIssuanceId = r.OriginalIssuanceId,
                OriginalIssuanceNo = r.OriginalIssuance?.IssuanceNo ?? string.Empty,
                TaskId = r.OriginalIssuance?.TaskId ?? 0,
                TaskName = r.OriginalIssuance?.Task?.Name ?? string.Empty,
                Reason = r.Reason,
                TotalItems = r.Items.Count,
                CreatedAt = r.CreatedAt,
                CreatedByName = r.CreatedBy.HasValue && userMap.TryGetValue(r.CreatedBy.Value, out var name) ? name : "N/A",
                Items = r.Items.Select(i => new MaterialReturnItemDto
                {
                    ReturnItemId = i.ReturnItemId,
                    MaterialId = i.MaterialId,
                    MaterialCode = i.Material?.Code ?? string.Empty,
                    MaterialName = i.Material?.Name ?? string.Empty,
                    UnitId = i.UnitId,
                    UnitName = i.Unit?.UnitName ?? string.Empty,
                    Quantity = i.Quantity,
                    ConversionRate = i.ConversionRate
                }).ToList()
            }).ToList();

            return new PagedList<MaterialReturnDto>(dtos, pagedEntities.TotalCount, pagedEntities.PageNumber, pagedEntities.PageSize);
        }
    }
}
