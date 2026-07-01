using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PurchaseOrders.Queries
{
    public record GetPurchaseOrderByIdQuery(long POId) : IRequest<ApiResponse<PurchaseOrderDetailDto>>;

    public class PurchaseOrderDetailDto
    {
        public long POId { get; set; }
        public string PONumber { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime OrderDate { get; set; }
        public DateOnly? ExpectedDeliveryDate { get; set; }
        public string? DeliveryAddress { get; set; }
        public string? PaymentTerms { get; set; }
        public string? Notes { get; set; }
        public string? CancelledReason { get; set; }
        public decimal TotalAmount { get; set; }

        public long? SupplierId { get; set; }
        public string SupplierName { get; set; } = string.Empty;
        public string? SupplierContactInfo { get; set; }

        public long? ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;

        public List<PODetailItemDto> Items { get; set; } = new();
        public List<LinkedRequestDto> LinkedRequests { get; set; } = new();
    }

    public class PODetailItemDto
    {
        public long POItemId { get; set; }
        public long MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public string Specification { get; set; } = string.Empty;
        public int UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal LineTotal { get; set; }
        public decimal ConversionRate { get; set; }
        public decimal TotalReceived { get; set; }
        public string? Notes { get; set; }
    }

    public class LinkedRequestDto
    {
        public long RequestId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string PhaseName { get; set; } = string.Empty;
    }

    public class GetPurchaseOrderByIdQueryHandler
        : IRequestHandler<GetPurchaseOrderByIdQuery, ApiResponse<PurchaseOrderDetailDto>>
    {
        private readonly IUnitOfWork _uow;

        public GetPurchaseOrderByIdQueryHandler(IUnitOfWork uow) => _uow = uow;

        public async Task<ApiResponse<PurchaseOrderDetailDto>> Handle(
            GetPurchaseOrderByIdQuery request, CancellationToken cancellationToken)
        {
            var po = await _uow.Repository<PurchaseOrder>().Query()
                .AsNoTracking()
                .Include(p => p.Supplier)
                .Include(p => p.Items).ThenInclude(i => i.Material)
                .Include(p => p.Items).ThenInclude(i => i.Unit)
                .Include(p => p.RequestLinks).ThenInclude(rl => rl.MaterialRequest)
                    .ThenInclude(mr => mr.Phase)
                .FirstOrDefaultAsync(p => p.POId == request.POId, cancellationToken)
                ?? throw new NotFoundException(nameof(PurchaseOrder), request.POId);

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
                LinkedRequests = po.RequestLinks.Select(rl => new LinkedRequestDto
                {
                    RequestId = rl.RequestId,
                    Reason = rl.MaterialRequest.Reason,
                    PhaseName = rl.MaterialRequest.Phase?.Name ?? string.Empty
                }).ToList()
            };

            return ApiResponse<PurchaseOrderDetailDto>.SuccessResult(dto);
        }
    }
}
