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
        : IRequestHandler<GetPurchaseOrderByIdQuery, ApiResponse<PurchaseOrderDetailDto>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;

        public GetPurchaseOrderByIdQueryHandler(IUnitOfWork uow, ICurrentUserService currentUserService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
        }

        public async Task<ApiResponse<PurchaseOrderDetailDto>> Handle(
            GetPurchaseOrderByIdQuery request, CancellationToken cancellationToken)
        {
            var po = await _uow.Repository<PurchaseOrder>().Query()
                .AsNoTracking()
                .Include(p => p.Supplier)
                .Include(p => p.Items).ThenInclude(i => i.Material)
                .Include(p => p.Items).ThenInclude(i => i.Unit)
                .Include(p => p.Request).ThenInclude(mr => mr!.Phase)
                .FirstOrDefaultAsync(p => p.POId == request.POId, cancellationToken)
                ?? throw new NotFoundException(nameof(PurchaseOrder), request.POId);

            // SiteEngineer chỉ được xem PO thuộc dự án mình được phân công.
            if (_currentUserService.IsInRole(UserRole.SiteEngineer))
            {
                var effectiveProjectId = po.ProjectId ?? po.Request?.Phase?.ProjectId;
                var currentUserId = _currentUserService.GetRequiredUserId();
                var isMember = effectiveProjectId.HasValue && await _uow.Repository<ProjectMember>().Query()
                    .AnyAsync(m => m.ProjectId == effectiveProjectId.Value && m.UserId == currentUserId, cancellationToken);
                if (!isMember)
                    throw new ForbiddenException("Bạn không được phân công vào dự án này nên không có quyền xem đơn hàng.");
            }

            // Project name
            string projectName = string.Empty;
            if (po.ProjectId.HasValue)
            {
                var project = await _uow.Repository<Project>().Query()
                    .AsNoTracking()
                    .Where(p => p.ProjectId == po.ProjectId.Value)
                    .Select(p => p.Name)
                    .FirstOrDefaultAsync(cancellationToken);
                projectName = project ?? string.Empty;
            }

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
                PaymentTerms = po.PaymentTerms,
                Notes = po.Notes,
                CancelledReason = po.CancelledReason,
                ClosedReason = po.ClosedReason,
                TotalAmount = po.TotalAmount,
                SupplierId = po.SupplierId,
                SupplierName = po.Supplier?.SupplierName ?? string.Empty,
                SupplierContactInfo = po.Supplier?.ContactInfo,
                ProjectId = po.ProjectId,
                ProjectName = projectName,
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

            return ApiResponse<PurchaseOrderDetailDto>.SuccessResult(dto);
        }
    }
}
