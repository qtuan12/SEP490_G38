using BPG.Application.Common.Models;
using BPG.Application.DTOs.PurchaseOrders;
using BPG.Application.Features.PurchaseOrders.Queries;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PurchaseOrders.Handlers
{
    public class GetPurchaseOrdersQueryHandler : IRequestHandler<GetPurchaseOrdersQuery, PagedList<PurchaseOrderDto>>
    {
        private readonly IUnitOfWork _uow;
        private readonly IPermissionService _permissionService;

        public GetPurchaseOrdersQueryHandler(
            IUnitOfWork uow,
            IPermissionService permissionService)
        {
            _uow = uow;
            _permissionService = permissionService;
        }

        public async Task<PagedList<PurchaseOrderDto>> Handle(GetPurchaseOrdersQuery request, CancellationToken cancellationToken)
        {
            if (!request.ProjectId.HasValue &&
                !_permissionService.HasSystemPermission(SystemPermission.ProcurementManage))
            {
                throw new ForbiddenException(
                    "Bạn chỉ được xem đơn hàng trong phạm vi dự án được cấp quyền.");
            }

            var query = _uow.Repository<PurchaseOrder>().Query()
                .Include(po => po.Supplier)
                .Include(po => po.Items)
                    .ThenInclude(i => i.Material)
                .Include(po => po.Items)
                    .ThenInclude(i => i.Unit)
                .AsNoTracking();

            if (request.ProjectId.HasValue)
            {
                query = query.Where(po => po.ProjectId == request.ProjectId.Value);
            }
            else
            {
                var accessibleProjectIds = await _permissionService.GetProjectIdsWithPermissionAsync(
                    ProjectPermission.View,
                    cancellationToken);
                query = query.Where(po => accessibleProjectIds.Contains(po.ProjectId));
            }

            if (!string.IsNullOrEmpty(request.Status))
                query = query.Where(po => po.Status == request.Status);

            if (!string.IsNullOrEmpty(request.Search))
                query = query.Where(po => po.PONumber.Contains(request.Search) ||
                    (po.Supplier != null && po.Supplier.SupplierName.Contains(request.Search)));

            if (request.OrderDateFrom.HasValue)
            {
                var from = request.OrderDateFrom.Value.ToDateTime(TimeOnly.MinValue);
                query = query.Where(po => po.OrderDate >= from);
            }

            if (request.OrderDateTo.HasValue)
            {
                var to = request.OrderDateTo.Value.ToDateTime(TimeOnly.MaxValue);
                query = query.Where(po => po.OrderDate <= to);
            }

            var totalCount = await query.CountAsync(cancellationToken);

            var pos = await query
                .OrderByDescending(po => po.OrderDate)
                .Skip((request.PageNumber - 1) * request.PageSize)
                .Take(request.PageSize)
                .ToListAsync(cancellationToken);

            var poIds = pos.Select(po => po.POId).ToList();
            var receivedQtyMap = new Dictionary<(long POId, long MaterialId), decimal>();

            if (poIds.Count != 0)
            {
                var receivedItems = await _uow.Repository<GoodsReceiptItem>().Query()
                    .AsNoTracking()
                    .Where(gri => poIds.Contains(gri.Receipt.POId) && gri.Receipt.Status == GoodsReceiptStatus.Approved)
                    .Select(gri => new { gri.Receipt.POId, gri.MaterialId, gri.Quantity })
                    .ToListAsync(cancellationToken);

                receivedQtyMap = receivedItems
                    .GroupBy(x => (x.POId, x.MaterialId))
                    .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));
            }

            var dtos = pos.Select(po => new PurchaseOrderDto
            {
                POId = po.POId,
                PONumber = po.PONumber,
                Status = po.Status,
                TotalAmount = po.TotalAmount,
                OrderDate = po.OrderDate,
                SupplierName = po.Supplier?.SupplierName ?? "N/A",
                Items = po.Items.Select(i =>
                {
                    receivedQtyMap.TryGetValue((po.POId, i.MaterialId), out var totalReceived);
                    return new PurchaseOrderItemDto
                    {
                        POItemId = i.POItemId,
                        MaterialId = i.MaterialId,
                        MaterialCode = i.Material.Code,
                        MaterialName = i.Material.Name,
                        Specification = i.Material.Specification ?? string.Empty,
                        UnitId = i.UnitId,
                        UnitName = i.Unit.UnitName,
                        Quantity = i.Quantity,
                        UnitPrice = i.UnitPrice,
                        LineTotal = i.LineTotal,
                        ConversionRate = i.ConversionRate,
                        TotalReceived = totalReceived
                    };
                }).ToList()
            }).ToList();

            return new PagedList<PurchaseOrderDto>(dtos, totalCount, request.PageNumber, request.PageSize);
        }
    }
}
