using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.DirectPurchases.Queries
{
    public record GetDirectPurchaseByIdQuery(long DirectPurchaseId) : IRequest<DirectPurchaseDetailDto>;

    public class DirectPurchaseDetailDto
    {
        public long DirectPurchaseId { get; set; }
        public string RequestNumber { get; set; } = string.Empty;
        public long ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;
        public string PhaseName { get; set; } = string.Empty;
        public string RequesterName { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public DateTime PurchaseDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public string AuditStatus { get; set; } = string.Empty;
        public string? AuditNote { get; set; }
        public string? AuditorName { get; set; }
        public DateTime? AuditedAt { get; set; }
        public string? AutoPONumber { get; set; }
        public string? AutoReceiptNo { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<DirectPurchaseItemDetailDto> Items { get; set; } = new();
        public List<string> InvoicePhotoUrls { get; set; } = new();
    }

    public class DirectPurchaseItemDetailDto
    {
        public long MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public string UnitName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal LineTotal { get; set; }
    }

    public class GetDirectPurchaseByIdQueryHandler : IRequestHandler<GetDirectPurchaseByIdQuery, DirectPurchaseDetailDto>
    {
        private readonly IUnitOfWork _uow;

        public GetDirectPurchaseByIdQueryHandler(IUnitOfWork uow) => _uow = uow;

        public async Task<DirectPurchaseDetailDto> Handle(GetDirectPurchaseByIdQuery request, CancellationToken ct)
        {
            var dp = await _uow.Repository<DirectPurchaseRequest>().Query()
                .Include(r => r.Project)
                .Include(r => r.Phase)
                .Include(r => r.Requester)
                .Include(r => r.Auditor)
                .Include(r => r.Items).ThenInclude(i => i.Material)
                .Include(r => r.Items).ThenInclude(i => i.Unit)
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.DirectPurchaseId == request.DirectPurchaseId, ct)
                ?? throw new NotFoundException(nameof(DirectPurchaseRequest), request.DirectPurchaseId);

            var invoiceUrls = await _uow.Repository<Attachment>().Query()
                .Where(a => a.EntityType == EntityType.DirectPurchaseRequest &&
                            a.EntityId == dp.DirectPurchaseId &&
                            a.AttachmentType == AttachmentType.InvoicePhoto &&
                            !a.IsDeleted)
                .Select(a => a.FileUrl)
                .ToListAsync(ct);

            string? poNumber = null;
            string? receiptNo = null;

            if (dp.AutoPOId.HasValue)
                poNumber = await _uow.Repository<PurchaseOrder>().Query()
                    .Where(p => p.POId == dp.AutoPOId.Value)
                    .Select(p => p.PONumber)
                    .FirstOrDefaultAsync(ct);

            if (dp.AutoReceiptId.HasValue)
                receiptNo = await _uow.Repository<GoodsReceipt>().Query()
                    .Where(g => g.ReceiptId == dp.AutoReceiptId.Value)
                    .Select(g => g.ReceiptNo)
                    .FirstOrDefaultAsync(ct);

            return new DirectPurchaseDetailDto
            {
                DirectPurchaseId = dp.DirectPurchaseId,
                RequestNumber = $"DP-{dp.DirectPurchaseId:D6}",
                ProjectId = dp.ProjectId,
                ProjectName = dp.Project.Name,
                PhaseName = dp.Phase.Name,
                RequesterName = dp.Requester.FullName,
                Reason = dp.Reason,
                TotalAmount = dp.TotalAmount,
                PurchaseDate = dp.PurchaseDate,
                Status = dp.Status,
                AuditStatus = dp.AuditStatus,
                AuditNote = dp.AuditNote,
                AuditorName = dp.Auditor?.FullName,
                AuditedAt = dp.AuditedAt,
                AutoPONumber = poNumber,
                AutoReceiptNo = receiptNo,
                CreatedAt = dp.CreatedAt,
                Items = dp.Items.Select(i => new DirectPurchaseItemDetailDto
                {
                    MaterialId = i.MaterialId,
                    MaterialCode = i.Material.Code,
                    MaterialName = i.Material.Name,
                    UnitName = i.Unit.UnitName,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    LineTotal = i.LineTotal,
                }).ToList(),
                InvoicePhotoUrls = invoiceUrls,
            };
        }
    }
}
