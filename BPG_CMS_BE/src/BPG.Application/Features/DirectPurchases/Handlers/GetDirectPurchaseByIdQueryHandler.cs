using BPG.Application.DTOs.DirectPurchases;
using BPG.Application.Features.DirectPurchases.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.DirectPurchases.Handlers
{
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
