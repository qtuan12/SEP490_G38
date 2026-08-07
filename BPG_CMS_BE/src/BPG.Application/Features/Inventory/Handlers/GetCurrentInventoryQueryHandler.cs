using BPG.Application.Common.Models;
using BPG.Application.DTOs.Inventory;
using BPG.Application.Features.Inventory.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

using BPG.Application.IServices;
using BPG.Domain.Exceptions;

namespace BPG.Application.Features.Inventory.Handlers
{
    public class GetCurrentInventoryQueryHandler : IRequestHandler<GetCurrentInventoryQuery, ApiResponse<List<CurrentInventoryDto>>>
    {
        private readonly IUnitOfWork _uow;
        private readonly IProjectAccessService _projectAccessService;

        public GetCurrentInventoryQueryHandler(IUnitOfWork uow, IProjectAccessService projectAccessService)
        {
            _uow = uow;
            _projectAccessService = projectAccessService;
        }

        public async Task<ApiResponse<List<CurrentInventoryDto>>> Handle(GetCurrentInventoryQuery request, CancellationToken cancellationToken)
        {
            var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
            if (!accessibleProjectIds.Contains(request.ProjectId))
            {
                throw new ForbiddenException("Bạn không có quyền xem tồn kho của dự án này.");
            }
            var config = await _uow.Repository<SystemConfig>().Query()
                .FirstOrDefaultAsync(c => c.ConfigKey == SystemConfigKeys.LowStockThreshold
                                       || c.ConfigKey == SystemConfigKeys.LowStockThresholdEn, cancellationToken);
            decimal threshold = 10m;
            if (config != null && decimal.TryParse(config.ConfigValue, out var val))
            {
                threshold = val;
            }

            // Query Phase names for mapping
            var phases = await _uow.Repository<Phase>().Query()
                .Where(p => p.ProjectId == request.ProjectId && !p.IsDeleted)
                .ToDictionaryAsync(p => p.PhaseId, p => p.Name, cancellationToken);

            // Fetch BOQ quantities grouped by (MaterialId, PhaseId)
            var boqByPhase = await _uow.Repository<BOQItem>().Query()
                .Where(b => b.Phase.ProjectId == request.ProjectId && !b.IsDeleted)
                .Select(b => new { b.MaterialId, b.PhaseId, BaseQty = b.Quantity / (b.ConversionRate == 0 ? 1 : b.ConversionRate) })
                .GroupBy(b => new { b.MaterialId, b.PhaseId })
                .Select(g => new { g.Key.MaterialId, g.Key.PhaseId, TotalBoq = g.Sum(x => x.BaseQty) })
                .ToListAsync(cancellationToken);

            // Fetch Used (issued) quantities grouped by (MaterialId, PhaseId)
            var usedByPhase = await _uow.Repository<MaterialIssuanceItem>().Query()
                .Where(mii => mii.Issuance.Task.Phase.ProjectId == request.ProjectId && !mii.Issuance.IsDeleted)
                .Select(mii => new { mii.MaterialId, mii.Issuance.Task.PhaseId, BaseQty = mii.Quantity / (mii.ConversionRate == 0 ? 1 : mii.ConversionRate) })
                .GroupBy(mii => new { mii.MaterialId, mii.PhaseId })
                .Select(g => new { g.Key.MaterialId, g.Key.PhaseId, TotalUsed = g.Sum(x => x.BaseQty) })
                .ToListAsync(cancellationToken);

            // Fetch last supplier name per material
            var lastSuppliers = await _uow.Repository<PurchaseOrderItem>().Query()
                .Where(poi => poi.PurchaseOrder!.Request!.Phase!.ProjectId == request.ProjectId && poi.PurchaseOrder!.SupplierId != null)
                .OrderByDescending(poi => poi.PurchaseOrder!.OrderDate)
                .Select(poi => new { poi.MaterialId, poi.PurchaseOrder!.Supplier!.SupplierName })
                .ToListAsync(cancellationToken);

            var supplierMap = lastSuppliers
                .GroupBy(x => x.MaterialId)
                .ToDictionary(g => g.Key, g => g.First().SupplierName);

            var inventoryDb = await _uow.Repository<CurrentInventory>().Query()
                .Include(ci => ci.Material)
                .Include(ci => ci.Unit)
                .Where(ci => ci.ProjectId == request.ProjectId)
                .ToListAsync(cancellationToken);

            var inventory = new List<CurrentInventoryDto>();
            foreach (var ci in inventoryDb)
            {
                supplierMap.TryGetValue(ci.MaterialId, out var supplierName);

                inventory.Add(new CurrentInventoryDto
                {
                    InventoryId = ci.InventoryId,
                    ProjectId = ci.ProjectId,
                    MaterialId = ci.MaterialId,
                    MaterialCode = ci.Material.Code,
                    MaterialName = ci.Material.Name,
                    Specification = ci.Material.Specification ?? string.Empty,
                    UnitId = ci.UnitId,
                    UnitName = ci.Unit.UnitName,
                    Quantity = ci.Quantity,
                    ReservedQuantity = ci.ReservedQuantity,
                    SafetyThreshold = threshold,
                    LastUpdated = ci.LastUpdated,
                    SupplierName = supplierName ?? "Chưa nhập",
                    BoqQuantity = 0,
                    UsedQuantity = 0
                });
            }

            // Group phase data by MaterialId
            var boqGroups = boqByPhase.GroupBy(x => x.MaterialId).ToDictionary(g => g.Key, g => g.ToList());
            var usedGroups = usedByPhase.GroupBy(x => x.MaterialId).ToDictionary(g => g.Key, g => g.ToList());

            // Populate phase-level usage breakdown in memory
            foreach (var item in inventory)
            {
                long materialId = item.MaterialId;
                var phaseIds = new HashSet<long>();

                if (boqGroups.TryGetValue(materialId, out var matBoqs))
                {
                    foreach (var x in matBoqs) phaseIds.Add(x.PhaseId);
                }
                else
                {
                    matBoqs = null;
                }

                if (usedGroups.TryGetValue(materialId, out var matUseds))
                {
                    foreach (var x in matUseds) phaseIds.Add(x.PhaseId);
                }
                else
                {
                    matUseds = null;
                }

                foreach (var phaseId in phaseIds)
                {
                    decimal boq = matBoqs?.FirstOrDefault(x => x.PhaseId == phaseId)?.TotalBoq ?? 0;
                    decimal used = matUseds?.FirstOrDefault(x => x.PhaseId == phaseId)?.TotalUsed ?? 0;
                    phases.TryGetValue(phaseId, out var phaseName);

                    item.PhaseUsages.Add(new MaterialPhaseUsageDto
                    {
                        PhaseId = phaseId,
                        PhaseName = phaseName ?? $"Giai đoạn {phaseId}",
                        BoqQuantity = boq,
                        UsedQuantity = used
                    });
                }

                // Overall cumulative budget & usage across all phases
                item.BoqQuantity = item.PhaseUsages.Sum(x => x.BoqQuantity);
                item.UsedQuantity = item.PhaseUsages.Sum(x => x.UsedQuantity);
            }

            return ApiResponse<List<CurrentInventoryDto>>.SuccessResult(inventory);
        }
    }
}
