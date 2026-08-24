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
            decimal thresholdPercentage = 10m;
            if (config != null
                && decimal.TryParse(config.ConfigValue, out var val)
                && val >= 0m
                && val <= 100m)
            {
                thresholdPercentage = val;
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

            // Fetch issued quantities grouped by (MaterialId, PhaseId)
            var issuedByPhase = await _uow.Repository<MaterialIssuanceItem>().Query()
                .Where(mii => mii.Issuance.Task.Phase.ProjectId == request.ProjectId && !mii.Issuance.IsDeleted)
                .Select(mii => new { mii.MaterialId, mii.Issuance.Task.PhaseId, BaseQty = mii.Quantity / (mii.ConversionRate == 0 ? 1 : mii.ConversionRate) })
                .GroupBy(mii => new { mii.MaterialId, mii.PhaseId })
                .Select(g => new { g.Key.MaterialId, g.Key.PhaseId, TotalIssued = g.Sum(x => x.BaseQty) })
                .ToListAsync(cancellationToken);

            // Returned material is linked to the phase through its original issuance.
            var returnedByPhase = await _uow.Repository<MaterialReturnItem>().Query()
                .Where(mri => mri.Return.OriginalIssuance.Task.Phase.ProjectId == request.ProjectId
                    && !mri.Return.IsDeleted
                    && !mri.Return.OriginalIssuance.IsDeleted)
                .Select(mri => new
                {
                    mri.MaterialId,
                    mri.Return.OriginalIssuance.Task.PhaseId,
                    BaseQty = mri.Quantity / (mri.ConversionRate == 0 ? 1 : mri.ConversionRate)
                })
                .GroupBy(mri => new { mri.MaterialId, mri.PhaseId })
                .Select(g => new { g.Key.MaterialId, g.Key.PhaseId, TotalReturned = g.Sum(x => x.BaseQty) })
                .ToListAsync(cancellationToken);

            var returnedLookup = returnedByPhase.ToDictionary(
                x => (x.MaterialId, x.PhaseId),
                x => x.TotalReturned);

            var usedByPhase = issuedByPhase
                .Select(x => new
                {
                    x.MaterialId,
                    x.PhaseId,
                    TotalUsed = x.TotalIssued - returnedLookup.GetValueOrDefault((x.MaterialId, x.PhaseId))
                })
                .ToList();

            var receivedByPhase = await _uow.Repository<GoodsReceiptItem>().Query()
                .Where(gri => gri.Receipt.PurchaseOrder.ProjectId == request.ProjectId
                    && gri.Receipt.Status == GoodsReceiptStatus.Approved
                    && gri.Receipt.PurchaseOrder.Request != null)
                .Select(gri => new {
                    gri.MaterialId,
                    PhaseId = gri.Receipt.PurchaseOrder.Request!.PhaseId,
                    BaseQty = gri.Quantity / (gri.ConversionRate == 0 ? 1 : gri.ConversionRate)
                })
                .GroupBy(gri => new { gri.MaterialId, gri.PhaseId })
                .Select(g => new { g.Key.MaterialId, g.Key.PhaseId, TotalReceived = g.Sum(x => x.BaseQty) })
                .ToListAsync(cancellationToken);

            // The latest supplier comes from actual approved receipts, not merely ordered or cancelled POs.
            var latestReceiptSources = await _uow.Repository<GoodsReceiptItem>().Query()
                .AsNoTracking()
                .Where(item => item.Receipt.PurchaseOrder.ProjectId == request.ProjectId
                    && item.Receipt.Status == GoodsReceiptStatus.Approved)
                .OrderByDescending(item => item.Receipt.CreatedAt)
                .Select(item => new
                {
                    item.MaterialId,
                    item.Receipt.PurchaseOrder.SupplierId,
                    IsDirectPurchase = item.Receipt.PurchaseOrder.PONumber.StartsWith("DP-PO-")
                })
                .ToListAsync(cancellationToken);

            var supplierIds = latestReceiptSources
                .Where(source => source.SupplierId.HasValue)
                .Select(source => source.SupplierId!.Value)
                .Distinct()
                .ToList();
            var supplierNames = supplierIds.Count == 0
                ? new Dictionary<long, string>()
                : await _uow.Repository<Supplier>().Query()
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(supplier => supplierIds.Contains(supplier.SupplierId))
                    .ToDictionaryAsync(supplier => supplier.SupplierId, supplier => supplier.SupplierName, cancellationToken);

            var supplierMap = latestReceiptSources
                .GroupBy(source => source.MaterialId)
                .ToDictionary(
                    group => group.Key,
                    group =>
                    {
                        var source = group.First();
                        if (source.SupplierId.HasValue
                            && supplierNames.TryGetValue(source.SupplierId.Value, out var supplierName))
                        {
                            return supplierName;
                        }

                        return source.IsDirectPurchase ? "Mua trực tiếp" : "Chưa xác định";
                    });

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
                    SafetyThreshold = 0,
                    LastUpdated = ci.LastUpdated,
                    SupplierName = supplierName ?? "Chưa nhập",
                    BoqQuantity = 0,
                    UsedQuantity = 0
                });
            }

            // Group phase data by MaterialId
            var boqGroups = boqByPhase.GroupBy(x => x.MaterialId).ToDictionary(g => g.Key, g => g.ToList());
            var usedGroups = usedByPhase.GroupBy(x => x.MaterialId).ToDictionary(g => g.Key, g => g.ToList());
            var receivedGroups = receivedByPhase.GroupBy(x => x.MaterialId).ToDictionary(g => g.Key, g => g.ToList());

            // Populate phase-level usage breakdown in memory
            foreach (var item in inventory)
            {
                long materialId = item.MaterialId;
                var phaseIds = phases.Keys.ToList(); // Always show ALL phases of the project

                if (!boqGroups.TryGetValue(materialId, out var matBoqs))
                {
                    matBoqs = null;
                }

                if (!usedGroups.TryGetValue(materialId, out var matUseds))
                {
                    matUseds = null;
                }

                if (!receivedGroups.TryGetValue(materialId, out var matReceiveds))
                {
                    matReceiveds = null;
                }

                foreach (var phaseId in phaseIds)
                {
                    decimal boq = matBoqs?.FirstOrDefault(x => x.PhaseId == phaseId)?.TotalBoq ?? 0;
                    decimal used = matUseds?.FirstOrDefault(x => x.PhaseId == phaseId)?.TotalUsed ?? 0;
                    decimal received = matReceiveds?.FirstOrDefault(x => x.PhaseId == phaseId)?.TotalReceived ?? 0;
                    phases.TryGetValue(phaseId, out var phaseName);

                    item.PhaseUsages.Add(new MaterialPhaseUsageDto
                    {
                        PhaseId = phaseId,
                        PhaseName = phaseName ?? $"Giai đoạn {phaseId}",
                        BoqQuantity = boq,
                        UsedQuantity = used,
                        ReceivedQuantity = received
                    });
                }

                // Overall cumulative budget & usage across all phases
                item.BoqQuantity = item.PhaseUsages.Sum(x => x.BoqQuantity);
                item.UsedQuantity = item.PhaseUsages.Sum(x => x.UsedQuantity);

                // Stock is stored in each material's base unit. A percentage of remaining BOQ
                // demand gives every material a comparable, unit-safe warning threshold.
                var remainingBoqQuantity = System.Math.Max(item.BoqQuantity - item.UsedQuantity, 0m);
                item.SafetyThreshold = remainingBoqQuantity * thresholdPercentage / 100m;
            }

            return ApiResponse<List<CurrentInventoryDto>>.SuccessResult(inventory);
        }
    }
}
