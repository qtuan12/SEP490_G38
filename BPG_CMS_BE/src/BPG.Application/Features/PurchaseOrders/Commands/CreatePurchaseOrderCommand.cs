using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PurchaseOrders.Commands
{
    public class CreatePurchaseOrderCommand : IRequest<long>
    {
        public string? PONumber { get; init; }
        public DateTime OrderDate { get; init; }
        public long? SupplierId { get; init; }
        public long ProjectId { get; init; }
        public DateOnly? ExpectedDeliveryDate { get; init; }
        public string? DeliveryAddress { get; init; }
        public string? PaymentTerms { get; init; }
        public string? Notes { get; init; }
        public List<long> RequestIds { get; init; } = new();
        public List<CreatePOItemDto> Items { get; init; } = new();
    }

    public class CreatePOItemDto
    {
        public long MaterialId { get; init; }
        public int UnitId { get; init; }
        public decimal Quantity { get; init; }
        public decimal UnitPrice { get; init; }
        public decimal ConversionRate { get; init; } = 1;
        public string? Notes { get; init; }
    }

    public class CreatePurchaseOrderCommandValidator : AbstractValidator<CreatePurchaseOrderCommand>
    {
        public CreatePurchaseOrderCommandValidator()
        {
            RuleFor(x => x.ProjectId).GreaterThan(0);
            RuleFor(x => x.OrderDate).NotEmpty();
            RuleFor(x => x.RequestIds).NotEmpty().WithMessage("Phải chọn ít nhất một yêu cầu vật tư.");
            RuleFor(x => x.Items).NotEmpty().WithMessage("Đơn hàng phải có ít nhất một dòng vật tư.");
            RuleFor(x => x.PONumber).MaximumLength(50).When(x => !string.IsNullOrEmpty(x.PONumber));
            RuleForEach(x => x.Items).ChildRules(item =>
            {
                item.RuleFor(i => i.MaterialId).GreaterThan(0);
                item.RuleFor(i => i.UnitId).GreaterThan(0);
                item.RuleFor(i => i.Quantity).GreaterThan(0);
                item.RuleFor(i => i.UnitPrice).GreaterThanOrEqualTo(0);
            });
        }
    }

    public class CreatePurchaseOrderCommandHandler : IRequestHandler<CreatePurchaseOrderCommand, long>
    {
        private readonly IUnitOfWork _uow;

        public CreatePurchaseOrderCommandHandler(IUnitOfWork uow) => _uow = uow;

        public async Task<long> Handle(CreatePurchaseOrderCommand request, CancellationToken cancellationToken)
        {
            // 1. Load and validate linked requests
            var linkedRequests = await _uow.Repository<MaterialRequest>().Query()
                .AsNoTracking()
                .Include(r => r.Items)
                .Where(r => request.RequestIds.Contains(r.RequestId))
                .ToListAsync(cancellationToken);

            if (linkedRequests.Count != request.RequestIds.Count)
                throw new NotFoundException(nameof(MaterialRequest), 0);

            var nonApproved = linkedRequests.Where(r => r.Status != MaterialRequestStatus.Approved).ToList();
            if (nonApproved.Count != 0)
                throw new BusinessException("ERR_REQUEST_NOT_APPROVED", "Một hoặc nhiều yêu cầu vật tư chưa được duyệt.");

            // 2. Validate quantities: PO qty ≤ total approved request qty per material
            var maxQtyByMaterial = linkedRequests
                .SelectMany(r => r.Items)
                .GroupBy(i => i.MaterialId)
                .ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity));

            foreach (var item in request.Items)
            {
                if (maxQtyByMaterial.TryGetValue(item.MaterialId, out var maxQty) && item.Quantity > maxQty)
                    throw new BusinessException("ERR_PO_QTY_EXCEEDS_REQUEST",
                        $"Số lượng vật tư (MaterialId={item.MaterialId}) trong PO vượt quá tổng số lượng đã được yêu cầu.");
            }

            // 3. Auto-generate or validate PONumber
            var poNumber = request.PONumber?.Trim();
            if (string.IsNullOrEmpty(poNumber))
            {
                var prefix = $"PO-{request.OrderDate:yyyyMMdd}-";
                var todayCount = await _uow.Repository<PurchaseOrder>().Query()
                    .CountAsync(po => po.PONumber.StartsWith(prefix), cancellationToken);
                poNumber = $"{prefix}{(todayCount + 1):D4}";
            }
            else
            {
                var exists = await _uow.Repository<PurchaseOrder>().Query()
                    .AnyAsync(po => po.PONumber == poNumber, cancellationToken);
                if (exists)
                    throw new BusinessException("ERR_PO_NUMBER_EXISTS", $"Số PO '{poNumber}' đã tồn tại trong hệ thống.");
            }

            // 4. Create PurchaseOrder
            var totalAmount = request.Items.Sum(i => i.Quantity * i.UnitPrice);
            var po = new PurchaseOrder
            {
                PONumber = poNumber,
                ProjectId = request.ProjectId,
                SupplierId = request.SupplierId,
                OrderDate = request.OrderDate,
                ExpectedDeliveryDate = request.ExpectedDeliveryDate,
                DeliveryAddress = request.DeliveryAddress?.Trim(),
                PaymentTerms = request.PaymentTerms?.Trim(),
                Notes = request.Notes?.Trim(),
                TotalAmount = totalAmount,
                Status = PurchaseOrderStatus.Sent,
            };

            await _uow.Repository<PurchaseOrder>().AddAsync(po, cancellationToken);
            await _uow.SaveChangesAsync(cancellationToken);

            // 5. Create PO items
            var poItems = request.Items.Select(i => new PurchaseOrderItem
            {
                POId = po.POId,
                MaterialId = i.MaterialId,
                UnitId = i.UnitId,
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice,
                LineTotal = i.Quantity * i.UnitPrice,
                ConversionRate = i.ConversionRate,
                Notes = i.Notes?.Trim()
            }).ToList();

            await _uow.Repository<PurchaseOrderItem>().AddRangeAsync(poItems, cancellationToken);

            // 6. Link requests via junction table
            var links = request.RequestIds.Select(rid => new PurchaseOrderRequest { POId = po.POId, RequestId = rid }).ToList();
            await _uow.Repository<PurchaseOrderRequest>().AddRangeAsync(links, cancellationToken);

            await _uow.SaveChangesAsync(cancellationToken);
            return po.POId;
        }
    }
}
