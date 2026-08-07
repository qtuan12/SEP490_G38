using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Application.Features.Inventory.Queries;
using BPG.Application.DTOs.Inventory;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

using BPG.Application.IServices;
using BPG.Domain.Exceptions;

namespace BPG.Application.Features.Inventory.Handlers
{
    public class GetInventoryTransactionsQueryHandler : IRequestHandler<GetInventoryTransactionsQuery, PagedList<InventoryTransactionDto>>
    {
        private readonly IUnitOfWork _uow;
        private readonly IProjectAccessService _projectAccessService;

        public GetInventoryTransactionsQueryHandler(IUnitOfWork uow, IProjectAccessService projectAccessService)
        {
            _uow = uow;
            _projectAccessService = projectAccessService;
        }

        public async Task<PagedList<InventoryTransactionDto>> Handle(GetInventoryTransactionsQuery request, CancellationToken cancellationToken)
        {
            var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
            if (!accessibleProjectIds.Contains(request.ProjectId))
            {
                throw new ForbiddenException("Bạn không có quyền xem biến động kho của dự án này.");
            }

            var query = _uow.Repository<InventoryTransaction>().Query()
                .Include(t => t.Material)
                    .ThenInclude(m => m.BaseUnit)
                .Where(t => t.ProjectId == request.ProjectId);

            if (request.MaterialId.HasValue)
            {
                query = query.Where(t => t.MaterialId == request.MaterialId.Value);
            }

            if (request.TransactionType.HasValue)
            {
                query = query.Where(t => t.TransactionType == request.TransactionType.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var search = request.Search.Trim().ToLower();
                query = query.Where(t => t.Material.Name.ToLower().Contains(search) 
                                       || t.Material.Code.ToLower().Contains(search));
            }

            var pagedEntities = await query
                .OrderByDescending(t => t.CreatedAt)
                .ToPagedListAsync(request, cancellationToken);

            // Fetch user names for CreatedBy
            var userIds = pagedEntities.Items.Where(t => t.CreatedBy.HasValue).Select(t => t.CreatedBy!.Value).Distinct().ToList();
            var userMap = new Dictionary<long, string>();
            if (userIds.Any())
            {
                userMap = await _uow.Repository<User>().Query()
                    .Where(u => userIds.Contains(u.UserId))
                    .ToDictionaryAsync(u => u.UserId, u => u.FullName, cancellationToken);
            }

            var dtos = pagedEntities.Items.Select(t => new InventoryTransactionDto
            {
                TransactionId = t.TransactionId,
                ProjectId = t.ProjectId,
                MaterialId = t.MaterialId,
                MaterialCode = t.Material.Code,
                MaterialName = t.Material.Name,
                TransactionType = t.TransactionType,
                ReferenceId = t.ReferenceId,
                QuantityChange = t.QuantityChange,
                BalanceAfter = t.BalanceAfter,
                UnitName = t.Material.BaseUnit?.UnitName ?? string.Empty,
                CreatedBy = t.CreatedBy,
                CreatedByName = t.CreatedBy.HasValue && userMap.TryGetValue(t.CreatedBy.Value, out var name) ? name : "N/A",
                CreatedAt = t.CreatedAt
            }).ToList();

            return new PagedList<InventoryTransactionDto>(dtos, pagedEntities.TotalCount, pagedEntities.PageNumber, pagedEntities.PageSize);
        }
    }
}
