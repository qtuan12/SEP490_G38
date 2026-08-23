using BPG.Application.Common.Models;
using BPG.Application.DTOs.DirectPurchases;
using BPG.Application.Features.DirectPurchases.Queries;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.DirectPurchases.Handlers
{
    public class GetDirectPurchaseRequestsQueryHandler : IRequestHandler<GetDirectPurchaseRequestsQuery, PagedList<DirectPurchaseRequestDto>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IProjectAccessService _projectAccessService;

        public GetDirectPurchaseRequestsQueryHandler(
            IUnitOfWork uow,
            ICurrentUserService currentUserService,
            IProjectAccessService projectAccessService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _projectAccessService = projectAccessService;
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

            // Giới hạn theo dự án được cấp quyền. Không có bước này thì gọi mà bỏ trống projectId
            // sẽ trả về phiếu mua khẩn cấp của toàn bộ dự án trong hệ thống.
            var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(ct);

            if (request.ProjectId.HasValue)
            {
                if (!accessibleProjectIds.Contains(request.ProjectId.Value))
                    throw new ForbiddenException("Bạn không có quyền xem phiếu mua khẩn cấp của dự án này.");

                query = query.Where(r => r.ProjectId == request.ProjectId.Value);
            }
            else
            {
                query = query.Where(r => accessibleProjectIds.Contains(r.ProjectId));
            }

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
                var term = request.SearchTerm.Trim().ToLower();
                // "SỐ PHIẾU" hiển thị cho người dùng có định dạng "DP-000003",
                // nhưng DirectPurchaseId lưu ở DB là số thô (vd 3) nên cần chuẩn hoá
                // term nhập vào (bỏ prefix "dp-" và các số 0 đứng đầu) trước khi so khớp.
                var normalizedTerm = term.StartsWith("dp-") ? term.Substring(3) : term;
                normalizedTerm = normalizedTerm.TrimStart('0');
                if (string.IsNullOrEmpty(normalizedTerm))
                    normalizedTerm = "0";

                query = query.Where(r =>
                    r.Reason.ToLower().Contains(term) ||
                    r.Phase.Name.ToLower().Contains(term) ||
                    r.Requester.FullName.ToLower().Contains(term) ||
                    r.DirectPurchaseId.ToString().Contains(normalizedTerm));
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
                PurchaseDate = DateOnly.FromDateTime(r.PurchaseDate),
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
