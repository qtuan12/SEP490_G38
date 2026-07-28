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
using UserRole = BPG.Domain.Constants.UserRole;

namespace BPG.Application.Features.PurchaseOrders.Handlers
{
    public class GetPurchaseOrdersQueryHandler : IRequestHandler<GetPurchaseOrdersQuery, PagedList<PurchaseOrderDto>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;

        public GetPurchaseOrdersQueryHandler(IUnitOfWork uow, ICurrentUserService currentUserService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
        }

        public async Task<PagedList<PurchaseOrderDto>> Handle(GetPurchaseOrdersQuery request, CancellationToken cancellationToken)
        {
            // Danh sách PO chung (không lọc theo dự án) chỉ dành cho Accountant.
            // Các role khác (TechnicalManager, SiteEngineer, Director) chỉ được xem PO trong phạm vi
            // một dự án cụ thể (tab "Đơn hàng" trong workspace dự án), bắt buộc phải truyền ProjectId.
            if (!_currentUserService.IsInRole(UserRole.Accountant))
            {
                if (!request.ProjectId.HasValue)
                    throw new ForbiddenException("Bạn chỉ được xem đơn hàng trong phạm vi dự án được phân công.");

                // SiteEngineer chỉ được xem đơn hàng của dự án mình được phân công là thành viên.
                if (_currentUserService.IsInRole(UserRole.SiteEngineer))
                {
                    var currentUserId = _currentUserService.GetRequiredUserId();
                    var isMember = await _uow.Repository<ProjectMember>().Query()
                        .AnyAsync(m => m.ProjectId == request.ProjectId.Value && m.UserId == currentUserId, cancellationToken);
                    if (!isMember)
                        throw new ForbiddenException("Bạn không được phân công vào dự án này nên không có quyền xem đơn hàng.");
                }
            }

            var query = _uow.Repository<PurchaseOrder>().Query()
                .Include(po => po.Supplier)
                .Include(po => po.Items)
                    .ThenInclude(i => i.Material)
                .Include(po => po.Items)
                    .ThenInclude(i => i.Unit)
                .AsNoTracking();

            if (request.ProjectId.HasValue)
                query = query.Where(po => po.ProjectId == request.ProjectId.Value);

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
