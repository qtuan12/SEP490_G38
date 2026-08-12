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
        private readonly ICurrentUserService _currentUserService;
        private readonly IProjectAccessService _projectAccessService;

        public GetPurchaseOrdersQueryHandler(
            IUnitOfWork uow,
            ICurrentUserService currentUserService,
            IProjectAccessService projectAccessService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _projectAccessService = projectAccessService;
        }

        public async Task<PagedList<PurchaseOrderDto>> Handle(GetPurchaseOrdersQuery request, CancellationToken cancellationToken)
        {
            if (!request.ProjectId.HasValue &&
                !_currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.Accountant, BPG.Domain.Constants.UserRole.TechnicalManager, BPG.Domain.Constants.UserRole.Director))
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

            // Phạm vi dự án phải kiểm ở CẢ hai nhánh. Trước đây chỉ nhánh không truyền projectId mới
            // lọc, mà câu chặn phía trên lại buộc người ngoài 4 vai trò toàn quyền phải truyền
            // projectId — tức đẩy đúng người cần chặn vào nhánh không kiểm.
            var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);

            if (request.ProjectId.HasValue)
            {
                if (!accessibleProjectIds.Contains(request.ProjectId.Value))
                    throw new ForbiddenException("Bạn không có quyền xem đơn mua hàng của dự án này.");

                query = query.Where(po => po.ProjectId == request.ProjectId.Value);
            }
            else
            {
                query = query.Where(po => accessibleProjectIds.Contains(po.ProjectId));
            }

            if (!string.IsNullOrEmpty(request.Status))
                query = query.Where(po => po.Status == request.Status);

            if (!string.IsNullOrEmpty(request.Search))
            {
                var matchingSupplierIds = await _uow.Repository<Supplier>().Query()
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(supplier => supplier.SupplierName.Contains(request.Search))
                    .Select(supplier => supplier.SupplierId)
                    .ToListAsync(cancellationToken);

                query = query.Where(po => po.PONumber.Contains(request.Search)
                    || (po.SupplierId.HasValue && matchingSupplierIds.Contains(po.SupplierId.Value)));
            }

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
            var supplierIds = pos
                .Where(po => po.SupplierId.HasValue)
                .Select(po => po.SupplierId!.Value)
                .Distinct()
                .ToList();
            var supplierNames = supplierIds.Count == 0
                ? new Dictionary<long, string>()
                : await _uow.Repository<Supplier>().Query()
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(supplier => supplierIds.Contains(supplier.SupplierId))
                    .ToDictionaryAsync(supplier => supplier.SupplierId, supplier => supplier.SupplierName, cancellationToken);
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
                OrderDate = DateOnly.FromDateTime(po.OrderDate),
                // Để null khi đơn không có NCC (đơn tự sinh từ phiếu mua khẩn cấp) - FE tự
                // quyết định nhãn hiển thị. Trả "N/A" ở đây thì FE không phân biệt được.
                SupplierName = po.SupplierId.HasValue
                    && supplierNames.TryGetValue(po.SupplierId.Value, out var supplierName)
                        ? supplierName
                        : null,
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


