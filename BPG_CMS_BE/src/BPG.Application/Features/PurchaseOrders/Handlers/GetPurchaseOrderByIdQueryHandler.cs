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
    public class GetPurchaseOrderByIdQueryHandler
        : IRequestHandler<GetPurchaseOrderByIdQuery, PurchaseOrderDetailDto>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IProjectAccessService _projectAccessService;

        public GetPurchaseOrderByIdQueryHandler(
            IUnitOfWork uow,
            ICurrentUserService currentUserService,
            IProjectAccessService projectAccessService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _projectAccessService = projectAccessService;
        }

        public async Task<PurchaseOrderDetailDto> Handle(
            GetPurchaseOrderByIdQuery request, CancellationToken cancellationToken)
        {
            var po = await _uow.Repository<PurchaseOrder>().Query()
                .AsNoTracking()
                .Include(p => p.Supplier)
                .Include(p => p.Project)
                .Include(p => p.Approver)
                .Include(p => p.Items).ThenInclude(i => i.Material)
                .Include(p => p.Items).ThenInclude(i => i.Unit)
                .Include(p => p.Request).ThenInclude(mr => mr!.Phase)
                .FirstOrDefaultAsync(p => p.POId == request.POId, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy đơn mua hàng.");

            // Endpoint mở cho ProjectViewers (gồm cả Kỹ sư công trường) nên phải chặn theo dự án:
            // không có bước này thì dò id là đọc được giá mua và nhà cung cấp của mọi dự án.
            var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
            if (!accessibleProjectIds.Contains(po.ProjectId))
                throw new ForbiddenException("Bạn không có quyền xem đơn mua hàng của dự án này.");

            // TotalReceived per material from approved GR items
            var receivedItems = await _uow.Repository<GoodsReceiptItem>().Query()
                .AsNoTracking()
                .Where(gri => gri.Receipt.POId == po.POId && gri.Receipt.Status == GoodsReceiptStatus.Approved)
                .Select(gri => new { gri.MaterialId, gri.Quantity })
                .ToListAsync(cancellationToken);

            var receivedMap = receivedItems
                .GroupBy(x => x.MaterialId)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));

            var dto = new PurchaseOrderDetailDto
            {
                POId = po.POId,
                PONumber = po.PONumber,
                Status = po.Status,
                OrderDate = po.OrderDate,
                ExpectedDeliveryDate = po.ExpectedDeliveryDate,
                DeliveryAddress = po.DeliveryAddress,
                Notes = po.Notes,
                CancelledReason = po.CancelledReason,
                ClosedReason = po.ClosedReason,
                TotalAmount = po.TotalAmount,
                ApproverName = po.Approver?.FullName,
                ApprovedAt = po.ApprovedAt,
                ApprovalNote = po.ApprovalNote,
                RejectedReason = po.RejectedReason,
                SupplierId = po.SupplierId,
                SupplierName = po.Supplier?.SupplierName ?? string.Empty,
                SupplierContactInfo = po.Supplier?.ContactInfo,
                ProjectId = po.ProjectId,
                ProjectName = po.Project?.Name ?? string.Empty,
                Items = po.Items.Select(i =>
                {
                    receivedMap.TryGetValue(i.MaterialId, out var received);
                    return new PODetailItemDto
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
                        TotalReceived = received,
                        Notes = i.Notes
                    };
                }).ToList(),
                LinkedRequests = po.Request == null
                    ? new List<LinkedRequestDto>()
                    : new List<LinkedRequestDto>
                    {
                        new LinkedRequestDto
                        {
                            RequestId = po.Request.RequestId,
                            Reason = po.Request.Reason,
                            ProjectId = po.Request.Phase?.ProjectId ?? 0,
                            PhaseId = po.Request.PhaseId,
                            PhaseName = po.Request.Phase?.Name ?? string.Empty
                        }
                    }
            };

            return dto;
        }
    }
}
