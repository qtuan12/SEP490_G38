using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.PurchaseOrders.Queries
{
    public record GetApprovedRequestsForPOQuery(long ProjectId) : IRequest<ApiResponse<List<ApprovedRequestForPODto>>>;

    public class ApprovedRequestForPODto
    {
        public long RequestId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public long ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;
        public long PhaseId { get; set; }
        public string PhaseName { get; set; } = string.Empty;
        public bool HasPO { get; set; }
        public List<RequestItemForPODto> Items { get; set; } = new();
    }

    public class RequestItemForPODto
    {
        public long RequestItemId { get; set; }
        public long MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public string Specification { get; set; } = string.Empty;
        public int UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal ConversionRate { get; set; }
    }

    public class GetApprovedRequestsForPOQueryHandler
        : IRequestHandler<GetApprovedRequestsForPOQuery, ApiResponse<List<ApprovedRequestForPODto>>>
    {
        private readonly IUnitOfWork _uow;

        public GetApprovedRequestsForPOQueryHandler(IUnitOfWork uow) => _uow = uow;

        public async Task<ApiResponse<List<ApprovedRequestForPODto>>> Handle(
            GetApprovedRequestsForPOQuery request, CancellationToken cancellationToken)
        {
            var requests = await _uow.Repository<MaterialRequest>().Query()
                .AsNoTracking()
                .Include(r => r.Phase).ThenInclude(p => p.Project)
                .Include(r => r.Items).ThenInclude(i => i.Material)
                .Include(r => r.Items).ThenInclude(i => i.Unit)
                .Where(r => r.Phase.ProjectId == request.ProjectId
                         && r.Status == MaterialRequestStatus.Approved)
                .ToListAsync(cancellationToken);

            // Check which requests already have a (non-cancelled) PO via RequestId column
            var requestIds = requests.Select(r => r.RequestId).ToList();
            var linkedRequestIds = await _uow.Repository<PurchaseOrder>().Query()
                .AsNoTracking()
                .Where(po => po.RequestId != null
                          && requestIds.Contains(po.RequestId.Value)
                          && po.Status != PurchaseOrderStatus.Cancelled)
                .Select(po => po.RequestId!.Value)
                .Distinct()
                .ToListAsync(cancellationToken);

            var dtos = requests.Select(r => new ApprovedRequestForPODto
            {
                RequestId = r.RequestId,
                Reason = r.Reason,
                ProjectId = r.Phase.ProjectId,
                ProjectName = r.Phase.Project?.Name ?? string.Empty,
                PhaseId = r.PhaseId,
                PhaseName = r.Phase.Name,
                HasPO = linkedRequestIds.Contains(r.RequestId),
                Items = r.Items.Select(i => new RequestItemForPODto
                {
                    RequestItemId = i.RequestItemId,
                    MaterialId = i.MaterialId,
                    MaterialCode = i.Material.Code,
                    MaterialName = i.Material.Name,
                    Specification = i.Material.Specification ?? string.Empty,
                    UnitId = i.UnitId,
                    UnitName = i.Unit.UnitName,
                    Quantity = i.Quantity,
                    ConversionRate = i.ConversionRate
                }).ToList()
            }).ToList();

            return ApiResponse<List<ApprovedRequestForPODto>>.SuccessResult(dtos);
        }
    }
}
