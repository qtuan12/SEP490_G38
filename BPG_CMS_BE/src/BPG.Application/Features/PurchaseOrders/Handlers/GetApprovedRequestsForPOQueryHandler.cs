using BPG.Application.Common.Models;
using BPG.Application.DTOs.PurchaseOrders;
using BPG.Application.Features.PurchaseOrders.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PurchaseOrders.Handlers
{
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

            // Sum quantities already ordered per (request, material) via active (non-cancelled) POs.
            // PO đã đóng (Closed) chỉ còn giữ chỗ phần ĐÃ NHẬN thực tế — phần chưa nhận được giải phóng
            // trở lại yêu cầu vật tư để có thể tạo PO khác.
            var requestIds = requests.Select(r => r.RequestId).ToList();
            var poItemRows = await _uow.Repository<PurchaseOrderItem>().Query()
                .AsNoTracking()
                .Where(pi => pi.PurchaseOrder.RequestId != null
                          && requestIds.Contains(pi.PurchaseOrder.RequestId.Value)
                          && pi.PurchaseOrder.Status != PurchaseOrderStatus.Cancelled)
                .Select(pi => new
                {
                    RequestId = pi.PurchaseOrder.RequestId!.Value,
                    pi.POId,
                    pi.MaterialId,
                    pi.Quantity,
                    POStatus = pi.PurchaseOrder.Status
                })
                .ToListAsync(cancellationToken);

            var closedPOIds = poItemRows
                .Where(x => x.POStatus == PurchaseOrderStatus.Closed)
                .Select(x => x.POId)
                .Distinct()
                .ToList();

            var receivedByClosedPO = closedPOIds.Count == 0
                ? new Dictionary<(long POId, long MaterialId), decimal>()
                : (await _uow.Repository<GoodsReceiptItem>().Query()
                    .AsNoTracking()
                    .Where(gri => closedPOIds.Contains(gri.Receipt.POId) && gri.Receipt.Status == GoodsReceiptStatus.Approved)
                    .GroupBy(gri => new { gri.Receipt.POId, gri.MaterialId })
                    .Select(g => new { g.Key.POId, g.Key.MaterialId, Received = g.Sum(x => x.Quantity) })
                    .ToListAsync(cancellationToken))
                    .ToDictionary(x => (x.POId, x.MaterialId), x => x.Received);

            var orderedMap = poItemRows
                .GroupBy(x => (x.RequestId, x.MaterialId))
                .ToDictionary(g => g.Key, g => g.Sum(x =>
                {
                    if (x.POStatus != PurchaseOrderStatus.Closed) return x.Quantity;
                    receivedByClosedPO.TryGetValue((x.POId, x.MaterialId), out var received);
                    return Math.Min(x.Quantity, received);
                }));

            var dtos = requests.Select(r => new ApprovedRequestForPODto
            {
                RequestId = r.RequestId,
                Reason = r.Reason,
                ProjectId = r.Phase.ProjectId,
                ProjectName = r.Phase.Project?.Name ?? string.Empty,
                PhaseId = r.PhaseId,
                PhaseName = r.Phase.Name,
                // Đã có PO khi tất cả vật tư của yêu cầu đều đã đặt hết số lượng
                HasPO = orderedMap.Keys.Any(k => k.RequestId == r.RequestId),
                Items = r.Items.Select(i =>
                {
                    orderedMap.TryGetValue((r.RequestId, i.MaterialId), out var ordered);
                    var remaining = i.Quantity - ordered;
                    return new RequestItemForPODto
                    {
                        RequestItemId = i.RequestItemId,
                        MaterialId = i.MaterialId,
                        MaterialCode = i.Material.Code,
                        MaterialName = i.Material.Name,
                        Specification = i.Material.Specification ?? string.Empty,
                        UnitId = i.UnitId,
                        UnitName = i.Unit.UnitName,
                        Quantity = i.Quantity,
                        ConversionRate = i.ConversionRate,
                        OrderedQuantity = ordered,
                        RemainingQuantity = remaining < 0 ? 0 : remaining
                    };
                }).ToList()
            }).ToList();

            return ApiResponse<List<ApprovedRequestForPODto>>.SuccessResult(dtos);
        }
    }
}
