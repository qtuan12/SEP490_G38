using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using BPG.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.GoodsReceipts.Queries
{
    public record GetGoodsReceiptDetailQuery(long ReceiptId) : IRequest<ApiResponse<GoodsReceiptDetailDto>>, IProjectRequirement
    {
        public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            var gr = await unitOfWork.Repository<GoodsReceipt>().Query()
                .AsNoTracking()
                .Include(g => g.PurchaseOrder)
                    .ThenInclude(po => po.Request)
                        .ThenInclude(r => r!.Phase)
                .FirstOrDefaultAsync(g => g.ReceiptId == ReceiptId, cancellationToken);

            if (gr == null)
                throw new NotFoundException(nameof(GoodsReceipt), ReceiptId);

            long projectId = gr.PurchaseOrder?.ProjectId ?? 0;
            if (projectId <= 0 && gr.PurchaseOrder?.Request?.Phase != null)
            {
                projectId = gr.PurchaseOrder.Request.Phase.ProjectId;
            }

            if (projectId <= 0)
                throw new NotFoundException(nameof(GoodsReceipt), ReceiptId);

            return projectId;
        }
    }

    public class GoodsReceiptDetailDto
    {
        public long ReceiptId { get; set; }
        public string ReceiptNo { get; set; } = string.Empty;
        public long POId { get; set; }
        public string PONumber { get; set; } = string.Empty;
        public string SupplierName { get; set; } = string.Empty;
        public string? DelivererInfo { get; set; }
        public string? DeliveryDocNo { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public List<GoodsReceiptItemDetailDto> Items { get; set; } = new();
        public List<string> Images { get; set; } = new();
    }

    public class GoodsReceiptItemDetailDto
    {
        public long ReceiptItemId { get; set; }
        public long MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public string Specification { get; set; } = string.Empty;
        public int UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
    }

    public class GetGoodsReceiptDetailQueryHandler : IRequestHandler<GetGoodsReceiptDetailQuery, ApiResponse<GoodsReceiptDetailDto>>
    {
        private readonly IUnitOfWork _uow;

        public GetGoodsReceiptDetailQueryHandler(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<ApiResponse<GoodsReceiptDetailDto>> Handle(GetGoodsReceiptDetailQuery request, CancellationToken cancellationToken)
        {
            var gr = await _uow.Repository<GoodsReceipt>().Query()
                .Include(g => g.PurchaseOrder)
                    .ThenInclude(po => po.Supplier)
                .Include(g => g.Items)
                    .ThenInclude(i => i.Material)
                .Include(g => g.Items)
                    .ThenInclude(i => i.Unit)
                .FirstOrDefaultAsync(g => g.ReceiptId == request.ReceiptId, cancellationToken);

            if (gr == null)
            {
                throw new NotFoundException(nameof(GoodsReceipt), request.ReceiptId);
            }

            // Fetch attachments (images)
            var attachments = await _uow.Repository<Attachment>().Query()
                .Where(a => a.EntityType == EntityType.GoodsReceipt && a.EntityId == gr.ReceiptId && !a.IsDeleted)
                .Select(a => a.FileUrl)
                .ToListAsync(cancellationToken);

            // Fetch CreatedBy User
            string creatorName = "N/A";
            if (gr.CreatedBy.HasValue)
            {
                var user = await _uow.Repository<User>().GetByIdAsync(gr.CreatedBy.Value, cancellationToken);
                if (user != null)
                {
                    creatorName = user.FullName;
                }
            }

            var dto = new GoodsReceiptDetailDto
            {
                ReceiptId = gr.ReceiptId,
                ReceiptNo = gr.ReceiptNo,
                POId = gr.POId,
                PONumber = gr.PurchaseOrder?.PONumber ?? string.Empty,
                SupplierName = gr.PurchaseOrder?.Supplier?.SupplierName ?? "N/A",
                DelivererInfo = gr.DelivererInfo,
                DeliveryDocNo = gr.DeliveryDocNo,
                Status = gr.Status,
                CreatedAt = gr.CreatedAt,
                CreatedByName = creatorName,
                Images = attachments,
                Items = gr.Items.Select(i => new GoodsReceiptItemDetailDto
                {
                    ReceiptItemId = i.ReceiptItemId,
                    MaterialId = i.MaterialId,
                    MaterialCode = i.Material.Code,
                    MaterialName = i.Material.Name,
                    Specification = i.Material.Specification ?? string.Empty,
                    UnitId = i.UnitId,
                    UnitName = i.Unit.UnitName,
                    Quantity = i.Quantity
                }).ToList()
            };

            return ApiResponse<GoodsReceiptDetailDto>.SuccessResult(dto);
        }
    }
}
