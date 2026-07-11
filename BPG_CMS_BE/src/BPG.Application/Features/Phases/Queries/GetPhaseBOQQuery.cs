using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Phases.Queries
{
    public record GetPhaseBOQQuery(long PhaseId) : IRequest<List<PhaseBOQItemDto>>;

    public class PhaseBOQItemDto
    {
        public long BOQItemId { get; set; }
        public long MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public string? MaterialSpec { get; set; }
        public int UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public decimal BOQQuantity { get; set; }
        public decimal ConversionRate { get; set; }
        public decimal AlreadyConsumed { get; set; }
        public decimal RemainingQuantity { get; set; }
    }

    public class GetPhaseBOQQueryHandler : IRequestHandler<GetPhaseBOQQuery, List<PhaseBOQItemDto>>
    {
        private readonly IUnitOfWork _uow;

        public GetPhaseBOQQueryHandler(IUnitOfWork uow) => _uow = uow;

        public async Task<List<PhaseBOQItemDto>> Handle(GetPhaseBOQQuery request, CancellationToken ct)
        {
            var boqItems = await _uow.Repository<BOQItem>().Query()
                .Include(b => b.Material).ThenInclude(m => m.BaseUnit)
                .Include(b => b.Unit)
                .Where(b => b.PhaseId == request.PhaseId && !b.IsDeleted)
                .AsNoTracking()
                .ToListAsync(ct);

            if (boqItems.Count == 0) return new List<PhaseBOQItemDto>();

            var materialIds = boqItems.Select(b => b.MaterialId).Distinct().ToList();

            // Sum from approved material requests
            var mrConsumedMap = await _uow.Repository<MaterialRequestItem>().Query()
                .Where(ri => ri.Request.PhaseId == request.PhaseId &&
                             materialIds.Contains(ri.MaterialId) &&
                             ri.Request.Status != MaterialRequestStatus.Rejected &&
                             ri.Request.Status != MaterialRequestStatus.Cancelled &&
                             !ri.Request.IsDeleted)
                .GroupBy(ri => ri.MaterialId)
                .Select(g => new { MaterialId = g.Key, TotalBase = g.Sum(ri => ri.Quantity * ri.ConversionRate) })
                .ToListAsync(ct);

            // Sum from existing direct purchase items (non-rejected)
            var dpConsumedMap = await _uow.Repository<DirectPurchaseItem>().Query()
                .Where(di => di.DirectPurchaseRequest.PhaseId == request.PhaseId &&
                             materialIds.Contains(di.MaterialId) &&
                             di.DirectPurchaseRequest.Status != DirectPurchaseStatus.Rejected &&
                             !di.DirectPurchaseRequest.IsDeleted)
                .GroupBy(di => di.MaterialId)
                .Select(g => new { MaterialId = g.Key, TotalBase = g.Sum(di => di.Quantity * di.ConversionRate) })
                .ToListAsync(ct);

            var mrMap = mrConsumedMap.ToDictionary(x => x.MaterialId, x => x.TotalBase);
            var dpMap = dpConsumedMap.ToDictionary(x => x.MaterialId, x => x.TotalBase);

            return boqItems.Select(b =>
            {
                decimal boqLimitInBase = b.Quantity * b.ConversionRate;
                decimal consumedInBase = (mrMap.TryGetValue(b.MaterialId, out var mr) ? mr : 0)
                                       + (dpMap.TryGetValue(b.MaterialId, out var dp) ? dp : 0);
                decimal remainingInBase = Math.Max(0, boqLimitInBase - consumedInBase);

                // Convert back to BOQ unit for display
                decimal cr = b.ConversionRate > 0 ? b.ConversionRate : 1;
                decimal consumed = consumedInBase / cr;
                decimal remaining = remainingInBase / cr;

                return new PhaseBOQItemDto
                {
                    BOQItemId = b.BOQItemId,
                    MaterialId = b.MaterialId,
                    MaterialCode = b.Material.Code,
                    MaterialName = b.Material.Name,
                    MaterialSpec = b.Material.Specification,
                    UnitId = b.UnitId,
                    UnitName = b.Unit.UnitName,
                    BOQQuantity = b.Quantity,
                    ConversionRate = b.ConversionRate,
                    AlreadyConsumed = Math.Round(consumed, 3),
                    RemainingQuantity = Math.Round(remaining, 3),
                };
            }).ToList();
        }
    }
}
