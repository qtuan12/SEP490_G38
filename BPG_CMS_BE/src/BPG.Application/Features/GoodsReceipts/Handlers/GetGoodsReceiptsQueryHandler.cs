using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Application.Features.GoodsReceipts.Queries;
using BPG.Application.DTOs.GoodsReceipts;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.GoodsReceipts.Handlers
{
    public class GetGoodsReceiptsQueryHandler : IRequestHandler<GetGoodsReceiptsQuery, PagedList<GoodsReceiptDto>>
    {
        private readonly IUnitOfWork _uow;

        public GetGoodsReceiptsQueryHandler(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<PagedList<GoodsReceiptDto>> Handle(GetGoodsReceiptsQuery request, CancellationToken cancellationToken)
        {
            var query = _uow.Repository<GoodsReceipt>().Query()
                .Include(gr => gr.PurchaseOrder)
                    .ThenInclude(po => po!.Request)
                        .ThenInclude(r => r!.Phase)
                .AsQueryable();

            if (request.ProjectId.HasValue)
            {
                query = query.Where(gr => gr.PurchaseOrder!.Request!.Phase!.ProjectId == request.ProjectId.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var search = request.Search.Trim().ToLower();
                query = query.Where(gr => gr.ReceiptNo.ToLower().Contains(search) 
                                       || gr.PurchaseOrder!.PONumber.ToLower().Contains(search)
                                       || (gr.DelivererInfo != null && gr.DelivererInfo.ToLower().Contains(search)));
            }

            var pagedEntities = await query
                .OrderByDescending(gr => gr.CreatedAt)
                .ToPagedListAsync(request, cancellationToken);

            var userIds = pagedEntities.Items.Where(gr => gr.CreatedBy.HasValue).Select(gr => gr.CreatedBy!.Value).Distinct().ToList();
            var userMap = new Dictionary<long, string>();
            if (userIds.Any())
            {
                userMap = await _uow.Repository<User>().Query()
                    .Where(u => userIds.Contains(u.UserId))
                    .ToDictionaryAsync(u => u.UserId, u => u.FullName, cancellationToken);
            }

            var dtos = pagedEntities.Items.Select(gr => new GoodsReceiptDto
            {
                ReceiptId = gr.ReceiptId,
                ReceiptNo = gr.ReceiptNo,
                POId = gr.POId,
                PONumber = gr.PurchaseOrder?.PONumber ?? string.Empty,
                DelivererInfo = gr.DelivererInfo,
                DeliveryDocNo = gr.DeliveryDocNo,
                Status = gr.Status,
                CreatedAt = gr.CreatedAt,
                CreatedByName = gr.CreatedBy.HasValue && userMap.TryGetValue(gr.CreatedBy.Value, out var name) ? name : "N/A"
            }).ToList();

            return new PagedList<GoodsReceiptDto>(dtos, pagedEntities.TotalCount, pagedEntities.PageNumber, pagedEntities.PageSize);
        }
    }
}
