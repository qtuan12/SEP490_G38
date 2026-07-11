using BPG.Application.Common.Models;
using BPG.Application.DTOs.DirectPurchases;
using BPG.Application.Features.DirectPurchases.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.DirectPurchases.Handlers
{
    public class GetDirectPurchaseRequestsQueryHandler : IRequestHandler<GetDirectPurchaseRequestsQuery, PagedList<DirectPurchaseRequestDto>>
    {
        private readonly IUnitOfWork _uow;

        public GetDirectPurchaseRequestsQueryHandler(IUnitOfWork uow) => _uow = uow;

        public async Task<PagedList<DirectPurchaseRequestDto>> Handle(GetDirectPurchaseRequestsQuery request, CancellationToken ct)
        {
            var query = _uow.Repository<DirectPurchaseRequest>().Query()
                .Include(r => r.Project)
                .Include(r => r.Phase)
                .Include(r => r.Requester)
                .Include(r => r.Auditor)
                .Include(r => r.Items)
                .AsNoTracking();

            if (request.ProjectId.HasValue)
                query = query.Where(r => r.ProjectId == request.ProjectId.Value);

            if (!string.IsNullOrEmpty(request.Status))
                query = query.Where(r => r.Status == request.Status);

            if (!string.IsNullOrEmpty(request.AuditStatus))
                query = query.Where(r => r.AuditStatus == request.AuditStatus);

            if (request.RequestedBy.HasValue)
                query = query.Where(r => r.RequestedBy == request.RequestedBy.Value);

            var totalCount = await query.CountAsync(ct);

            var items = await query
                .OrderByDescending(r => r.CreatedAt)
                .Skip((request.PageNumber - 1) * request.PageSize)
                .Take(request.PageSize)
                .ToListAsync(ct);

            var dtos = items.Select(r => new DirectPurchaseRequestDto
            {
                DirectPurchaseId = r.DirectPurchaseId,
                RequestNumber = $"DP-{r.DirectPurchaseId:D6}",
                ProjectId = r.ProjectId,
                ProjectName = r.Project.Name,
                PhaseName = r.Phase.Name,
                RequesterName = r.Requester.FullName,
                Reason = r.Reason,
                TotalAmount = r.TotalAmount,
                PurchaseDate = r.PurchaseDate,
                Status = r.Status,
                AuditStatus = r.AuditStatus,
                AuditNote = r.AuditNote,
                AuditorName = r.Auditor?.FullName,
                AuditedAt = r.AuditedAt,
                ItemCount = r.Items.Count,
                CreatedAt = r.CreatedAt
            }).ToList();

            return new PagedList<DirectPurchaseRequestDto>(dtos, totalCount, request.PageNumber, request.PageSize);
        }
    }
}
