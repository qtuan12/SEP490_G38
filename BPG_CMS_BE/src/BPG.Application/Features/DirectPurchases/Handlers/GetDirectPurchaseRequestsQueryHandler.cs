using BPG.Application.Common.Models;
using BPG.Application.DTOs.DirectPurchases;
using BPG.Application.Features.DirectPurchases.Queries;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.DirectPurchases.Handlers
{
    public class GetDirectPurchaseRequestsQueryHandler : IRequestHandler<GetDirectPurchaseRequestsQuery, PagedList<DirectPurchaseRequestDto>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;

        public GetDirectPurchaseRequestsQueryHandler(IUnitOfWork uow, ICurrentUserService currentUserService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
        }

        public async Task<PagedList<DirectPurchaseRequestDto>> Handle(GetDirectPurchaseRequestsQuery request, CancellationToken ct)
        {
            long currentUserId = _currentUserService.GetRequiredUserId();

            var query = _uow.Repository<DirectPurchaseRequest>().Query()
                .Include(r => r.Project)
                .Include(r => r.Phase)
                .Include(r => r.Requester)
                .Include(r => r.Auditor)
                .Include(r => r.Approver)
                .Include(r => r.Items)
                .AsNoTracking();

            // Phiếu nháp là việc riêng của người soạn: chưa gửi, chưa nhập kho, không ai khác thấy.
            query = query.Where(r => r.Status != DirectPurchaseStatus.Draft || r.RequestedBy == currentUserId);

            if (request.ProjectId.HasValue)
                query = query.Where(r => r.ProjectId == request.ProjectId.Value);

            if (!string.IsNullOrEmpty(request.Status))
                query = query.Where(r => r.Status == request.Status);

            if (!string.IsNullOrEmpty(request.AuditStatus))
                query = query.Where(r => r.AuditStatus == request.AuditStatus);

            if (!string.IsNullOrEmpty(request.BOQCheckStatus))
                query = query.Where(r => r.BOQCheckStatus == request.BOQCheckStatus);

            if (request.RequestedBy.HasValue)
                query = query.Where(r => r.RequestedBy == request.RequestedBy.Value);

            if (!string.IsNullOrEmpty(request.SearchTerm))
            {
                var term = request.SearchTerm.ToLower();
                query = query.Where(r =>
                    r.Reason.ToLower().Contains(term) ||
                    r.DirectPurchaseId.ToString().Contains(term));
            }

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
                RequestedBy = r.RequestedBy,
                RequesterName = r.Requester.FullName,
                Reason = r.Reason,
                TotalAmount = r.TotalAmount,
                PurchaseDate = r.PurchaseDate,
                Status = r.Status,
                AuditStatus = r.AuditStatus,
                BOQCheckStatus = r.BOQCheckStatus,
                AuditNote = r.AuditNote,
                AuditorName = r.Auditor?.FullName,
                AuditedAt = r.AuditedAt,
                ApprovalNote = r.ApprovalNote,
                ApproverName = r.Approver?.FullName,
                ApprovedAt = r.ApprovedAt,
                ItemCount = r.Items.Count,
                CreatedAt = r.CreatedAt
            }).ToList();

            return new PagedList<DirectPurchaseRequestDto>(dtos, totalCount, request.PageNumber, request.PageSize);
        }
    }
}
