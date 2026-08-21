using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.Common.Models;
using BPG.Application.Common.Helpers;
using BPG.Application.DTOs.Reports;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Reports.Queries.GetMaterialReturnsAndSurplusReport;

public record GetMaterialReturnsAndSurplusReportQuery(long ProjectId, DateTime? FromDate = null, DateTime? ToDate = null)
    : IRequest<ApiResponse<MaterialReturnsAndSurplusReportDto>>;

public class GetMaterialReturnsAndSurplusReportQueryHandler
    : IRequestHandler<GetMaterialReturnsAndSurplusReportQuery, ApiResponse<MaterialReturnsAndSurplusReportDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProjectAccessService _projectAccessService;

    public GetMaterialReturnsAndSurplusReportQueryHandler(
        IUnitOfWork unitOfWork,
        IProjectAccessService projectAccessService)
    {
        _unitOfWork = unitOfWork;
        _projectAccessService = projectAccessService;
    }

    public async Task<ApiResponse<MaterialReturnsAndSurplusReportDto>> Handle(
        GetMaterialReturnsAndSurplusReportQuery request, CancellationToken cancellationToken)
    {
        var accessibleIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
        if (request.ProjectId > 0 && !accessibleIds.Contains(request.ProjectId))
        {
            throw new BPG.Domain.Exceptions.BusinessException("ERR_FORBIDDEN", "Bạn không có quyền xem báo cáo của dự án này.");
        }

        var dateRange = ReportDateRange.Create(request.FromDate, request.ToDate);
        var fromDt = dateRange.From;
        var toDt = dateRange.ToInclusive;

        // 1. Get Project info
        string projectName = "Tất cả dự án (Toàn công ty)";
        if (request.ProjectId > 0)
        {
            var proj = await _unitOfWork.Repository<Project>().Query()
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, cancellationToken);
            if (proj != null)
            {
                projectName = proj.Name;
            }
        }

        // 2. Load a quantity-weighted historical price in each material's base unit.
        // Restrict the price pool to the same accessible project scope and report cut-off.
        var poPriceQuery = _unitOfWork.Repository<PurchaseOrderItem>().Query()
            .AsNoTracking()
            .Where(poi => poi.UnitPrice > 0
                && poi.PurchaseOrder.Status != BPG.Domain.Constants.PurchaseOrderStatus.Draft
                && poi.PurchaseOrder.Status != BPG.Domain.Constants.PurchaseOrderStatus.PendingApproval
                && poi.PurchaseOrder.Status != BPG.Domain.Constants.PurchaseOrderStatus.Rejected
                && poi.PurchaseOrder.Status != BPG.Domain.Constants.PurchaseOrderStatus.Cancelled
                && (request.ProjectId > 0
                    ? poi.PurchaseOrder.ProjectId == request.ProjectId
                    : accessibleIds.Contains(poi.PurchaseOrder.ProjectId)));
        if (toDt.HasValue)
        {
            poPriceQuery = poPriceQuery.Where(poi => poi.PurchaseOrder.OrderDate <= toDt.Value);
        }

        var priceTotals = await poPriceQuery
            .GroupBy(poi => poi.MaterialId)
            .Select(g => new
            {
                MaterialId = g.Key,
                TotalBaseQuantity = g.Sum(x => x.Quantity / (x.ConversionRate > 0 ? x.ConversionRate : 1m)),
                TotalValue = g.Sum(x => x.Quantity * x.UnitPrice)
            })
            .ToListAsync(cancellationToken);
        var baseUnitPriceMap = priceTotals.ToDictionary(
            x => x.MaterialId,
            x => x.TotalBaseQuantity > 0 ? x.TotalValue / x.TotalBaseQuantity : 0m);

        // 3. Query Material Returns
        var returnsQuery = _unitOfWork.Repository<MaterialReturn>().Query()
            .Include(r => r.OriginalIssuance)
                .ThenInclude(i => i.Task)
                    .ThenInclude(t => t.Phase)
                        .ThenInclude(p => p.Project)
            .Include(r => r.Items)
                .ThenInclude(i => i.Material)
                    .ThenInclude(m => m.BaseUnit)
            .Include(r => r.Items)
                .ThenInclude(i => i.Unit)
            .AsSplitQuery()
            .AsNoTracking();

        if (request.ProjectId > 0)
        {
            returnsQuery = returnsQuery.Where(r => r.OriginalIssuance.Task.Phase.ProjectId == request.ProjectId);
        }
        else
        {
            returnsQuery = returnsQuery.Where(r => accessibleIds.Contains(r.OriginalIssuance.Task.Phase.ProjectId));
        }

        if (fromDt.HasValue)
        {
            returnsQuery = returnsQuery.Where(r => r.CreatedAt >= fromDt.Value);
        }
        if (toDt.HasValue)
        {
            returnsQuery = returnsQuery.Where(r => r.CreatedAt <= toDt.Value);
        }

        var returnList = await returnsQuery
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        // 4. Query Surplus Requests & Items & Actions
        var surplusQuery = _unitOfWork.Repository<SurplusRequest>().Query()
            .Include(s => s.Project)
            .Include(s => s.Items)
                .ThenInclude(i => i.Material)
                    .ThenInclude(m => m.BaseUnit)
            .Include(s => s.Items)
                .ThenInclude(i => i.Unit)
            .Include(s => s.Items)
                .ThenInclude(i => i.ReturnToSuppliers)
                    .ThenInclude(rs => rs.Supplier)
            .Include(s => s.Items)
                .ThenInclude(i => i.Transfers)
                    .ThenInclude(t => t.FromProject)
            .Include(s => s.Items)
                .ThenInclude(i => i.Transfers)
                    .ThenInclude(t => t.ToProject)
            .Include(s => s.Items)
                .ThenInclude(i => i.Liquidations)
            .AsSplitQuery()
            .AsNoTracking();

        if (request.ProjectId > 0)
        {
            surplusQuery = surplusQuery.Where(s => s.ProjectId == request.ProjectId);
        }
        else
        {
            surplusQuery = surplusQuery.Where(s => accessibleIds.Contains(s.ProjectId));
        }

        if (fromDt.HasValue)
        {
            surplusQuery = surplusQuery.Where(s => s.CreatedAt >= fromDt.Value);
        }
        if (toDt.HasValue)
        {
            surplusQuery = surplusQuery.Where(s => s.CreatedAt <= toDt.Value);
        }

        var surplusList = await surplusQuery
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

        // 5. Map Users for creators
        var userIds = returnList.Where(r => r.CreatedBy.HasValue).Select(r => r.CreatedBy!.Value)
            .Concat(surplusList.Where(s => s.CreatedBy.HasValue).Select(s => s.CreatedBy!.Value))
            .Distinct()
            .ToList();

        var userMap = new Dictionary<long, string>();
        if (userIds.Count > 0)
        {
            userMap = await _unitOfWork.Repository<User>().Query()
                .AsNoTracking()
                .Where(u => userIds.Contains(u.UserId))
                .ToDictionaryAsync(u => u.UserId, u => u.FullName, cancellationToken);
        }

        // 6. Aggregate Return Metrics
        int totalReturnSlips = returnList.Count;
        int totalReturnItemsCount = returnList.Sum(r => r.Items.Count);
        int totalReturnDistinctMaterialsCount = returnList.SelectMany(r => r.Items).Select(i => i.MaterialId).Distinct().Count();
        decimal totalReturnVolume = returnList.Sum(r => r.Items.Sum(i => i.Quantity));
        decimal totalReturnEstimatedValue = returnList.Sum(r => r.Items.Sum(i =>
            i.Quantity / (i.ConversionRate > 0 ? i.ConversionRate : 1m)
            * baseUnitPriceMap.GetValueOrDefault(i.MaterialId, 0m)));

        var returnReportItems = returnList.Select(r =>
        {
            var proj = r.OriginalIssuance?.Task?.Phase?.Project;
            var task = r.OriginalIssuance?.Task;
            var createdByName = r.CreatedBy.HasValue && userMap.TryGetValue(r.CreatedBy.Value, out var name) ? name : "Hệ thống";

            var itemsDetail = r.Items.Select(item =>
            {
                var conversionRate = item.ConversionRate > 0 ? item.ConversionRate : 1m;
                var baseUnitPrice = baseUnitPriceMap.GetValueOrDefault(item.MaterialId, 0m);
                var displayUnitPrice = baseUnitPrice / conversionRate;
                return new MaterialReturnItemDetailDto
                {
                    ReturnItemId = item.ReturnItemId,
                    MaterialId = item.MaterialId,
                    MaterialCode = item.Material?.Code ?? string.Empty,
                    MaterialName = item.Material?.Name ?? string.Empty,
                    UnitName = item.Unit?.UnitName ?? item.Material?.BaseUnit?.UnitName ?? string.Empty,
                    Quantity = item.Quantity,
                    UnitPrice = displayUnitPrice,
                    EstimatedValueVnd = item.Quantity * displayUnitPrice
                };
            }).ToList();

            return new MaterialReturnReportItemDto
            {
                MaterialReturnId = r.MaterialReturnId,
                ReturnNo = r.ReturnNo,
                ProjectId = proj?.ProjectId ?? 0,
                ProjectName = proj?.Name ?? string.Empty,
                OriginalIssuanceId = r.OriginalIssuanceId,
                OriginalIssuanceNo = r.OriginalIssuance?.IssuanceNo ?? string.Empty,
                TaskId = task?.TaskId ?? 0,
                TaskName = task?.Name ?? string.Empty,
                Reason = r.Reason,
                ReturnDate = r.CreatedAt,
                CreatedByName = createdByName,
                TotalItems = itemsDetail.Count,
                TotalEstimatedValueVnd = itemsDetail.Sum(i => i.EstimatedValueVnd),
                Items = itemsDetail
            };
        }).ToList();

        // 7. Aggregate Surplus Metrics & Actions
        int totalSurplusBatches = surplusList.Count;
        var allSurplusItems = surplusList.SelectMany(s => s.Items.Select(i => new { Batch = s, Item = i })).ToList();
        int totalSurplusItems = allSurplusItems.Count;
        decimal totalSurplusQuantity = allSurplusItems.Sum(x => x.Item.Quantity);
        decimal totalSurplusProcessedQuantity = allSurplusItems.Sum(x => x.Item.ProcessedQuantity);
        decimal totalSurplusRemainingQuantity = Math.Max(0, totalSurplusQuantity - totalSurplusProcessedQuantity);

        int totalSurplusResolvedItemsCount = allSurplusItems.Count(x =>
            x.Item.ProcessedQuantity >= x.Item.Quantity ||
            x.Item.Status == "Completed" ||
            x.Item.Status == "Closed");
        int totalSurplusPendingItemsCount = totalSurplusItems - totalSurplusResolvedItemsCount;

        decimal surplusResolutionRatePercent = totalSurplusItems > 0
            ? Math.Min(100, Math.Round(((decimal)totalSurplusResolvedItemsCount / totalSurplusItems) * 100, 1))
            : 0;

        decimal totalSupplierRefundAmount = 0;
        decimal totalLiquidationAmount = 0;
        decimal totalTransferredQuantity = 0;
        int totalTransferredActionsCount = 0;

        decimal returnSupplierQuantity = 0;
        decimal liquidationQuantity = 0;
        int returnSupplierActionsCount = 0;
        int liquidationActionsCount = 0;

        var surplusActionList = new List<SurplusActionDetailDto>();
        var surplusRequestReportItems = new List<SurplusRequestReportItemDto>();

        foreach (var entry in allSurplusItems)
        {
            var batch = entry.Batch;
            var item = entry.Item;
            var createdByName = batch.CreatedBy.HasValue && userMap.TryGetValue(batch.CreatedBy.Value, out var cName) ? cName : "Hệ thống";

            surplusRequestReportItems.Add(new SurplusRequestReportItemDto
            {
                SurplusRequestId = batch.SurplusRequestId,
                SurplusRequestItemId = item.SurplusRequestItemId,
                ProjectId = batch.ProjectId,
                ProjectName = batch.Project?.Name ?? string.Empty,
                MaterialId = item.MaterialId,
                MaterialCode = item.Material?.Code ?? string.Empty,
                MaterialName = item.Material?.Name ?? string.Empty,
                UnitName = item.Unit?.UnitName ?? item.Material?.BaseUnit?.UnitName ?? string.Empty,
                SurplusQuantity = item.Quantity,
                ProcessedQuantity = item.ProcessedQuantity,
                RemainingQuantity = Math.Max(0, item.Quantity - item.ProcessedQuantity),
                Status = item.Status,
                Reason = batch.Reason,
                CreatedAt = batch.CreatedAt,
                CreatedByName = createdByName
            });

            // Action: Return to Supplier
            foreach (var rSupplier in item.ReturnToSuppliers)
            {
                returnSupplierActionsCount++;
                returnSupplierQuantity += rSupplier.ReturnQuantity;
                if (rSupplier.RefundAmount.HasValue)
                {
                    totalSupplierRefundAmount += rSupplier.RefundAmount.Value;
                }

                surplusActionList.Add(new SurplusActionDetailDto
                {
                    ActionType = "ReturnSupplier",
                    ActionId = rSupplier.SurplusReturnSupplierId,
                    SurplusRequestItemId = item.SurplusRequestItemId,
                    ProjectId = batch.ProjectId,
                    ProjectName = batch.Project?.Name ?? string.Empty,
                    MaterialCode = item.Material?.Code ?? string.Empty,
                    MaterialName = item.Material?.Name ?? string.Empty,
                    UnitName = item.Unit?.UnitName ?? item.Material?.BaseUnit?.UnitName ?? string.Empty,
                    Quantity = rSupplier.ReturnQuantity,
                    FinancialValueVnd = rSupplier.RefundAmount,
                    PartnerOrDestination = rSupplier.Supplier?.SupplierName ?? "Nhà cung cấp",
                    Status = "Hoàn tất",
                    ActionDate = rSupplier.CreatedAt,
                    Note = rSupplier.Note
                });
            }

            // Action: Transfers
            foreach (var transfer in item.Transfers)
            {
                totalTransferredQuantity += transfer.TransferQuantity;
                totalTransferredActionsCount++;

                surplusActionList.Add(new SurplusActionDetailDto
                {
                    ActionType = "Transfer",
                    ActionId = transfer.SurplusTransferId,
                    SurplusRequestItemId = item.SurplusRequestItemId,
                    ProjectId = batch.ProjectId,
                    ProjectName = transfer.FromProject?.Name ?? batch.Project?.Name ?? string.Empty,
                    MaterialCode = item.Material?.Code ?? string.Empty,
                    MaterialName = item.Material?.Name ?? string.Empty,
                    UnitName = item.Unit?.UnitName ?? item.Material?.BaseUnit?.UnitName ?? string.Empty,
                    Quantity = transfer.TransferQuantity,
                    FinancialValueVnd = null,
                    PartnerOrDestination = transfer.ToProject?.Name ?? $"Dự án #{transfer.ToProjectId}",
                    Status = transfer.Status,
                    ActionDate = transfer.CreatedAt,
                    Note = $"Chuyển từ {transfer.FromProject?.Name} sang {transfer.ToProject?.Name}"
                });
            }

            // Action: Liquidations
            foreach (var liq in item.Liquidations)
            {
                liquidationActionsCount++;
                liquidationQuantity += liq.LiquidationQuantity;
                totalLiquidationAmount += liq.TotalAmount;

                surplusActionList.Add(new SurplusActionDetailDto
                {
                    ActionType = "Liquidation",
                    ActionId = liq.SurplusLiquidationId,
                    SurplusRequestItemId = item.SurplusRequestItemId,
                    ProjectId = batch.ProjectId,
                    ProjectName = batch.Project?.Name ?? string.Empty,
                    MaterialCode = item.Material?.Code ?? string.Empty,
                    MaterialName = item.Material?.Name ?? string.Empty,
                    UnitName = item.Unit?.UnitName ?? item.Material?.BaseUnit?.UnitName ?? string.Empty,
                    Quantity = liq.LiquidationQuantity,
                    FinancialValueVnd = liq.TotalAmount,
                    PartnerOrDestination = !string.IsNullOrWhiteSpace(liq.BuyerName) ? liq.BuyerName : "Bên thu mua thanh lý",
                    Status = "Đã thanh lý",
                    ActionDate = liq.CreatedAt,
                    Note = "Bán thanh lý thu hồi vốn"
                });
            }
        }

        decimal totalFinancialRecoveryAmount = totalSupplierRefundAmount + totalLiquidationAmount;
        int totalTransferredItemsCount = allSurplusItems.Count(x => x.Item.Transfers.Any());

        var surplusMethodBreakdown = new SurplusMethodBreakdownDto
        {
            ReturnSupplierActionsCount = returnSupplierActionsCount,
            TransferActionsCount = totalTransferredActionsCount,
            LiquidationActionsCount = liquidationActionsCount,
            PendingRemainingItemsCount = totalSurplusPendingItemsCount,
            ReturnSupplierQuantity = returnSupplierQuantity,
            TransferQuantity = totalTransferredQuantity,
            LiquidationQuantity = liquidationQuantity,
            PendingRemainingQuantity = totalSurplusRemainingQuantity,
            ReturnSupplierValueVnd = totalSupplierRefundAmount,
            LiquidationValueVnd = totalLiquidationAmount
        };

        // 8. Monthly Trends (Past 12 months)
        var referenceEnd = toDt ?? DateTime.UtcNow;
        var monthlyTrends = new List<ReturnAndSurplusMonthlyTrendDto>();

        for (int i = 11; i >= 0; i--)
        {
            var targetMonthDate = referenceEnd.AddMonths(-i);
            int y = targetMonthDate.Year;
            int m = targetMonthDate.Month;
            string monthLabel = $"T{m:D2}/{y}";

            var returnsInMonth = returnList.Where(r => r.CreatedAt.Year == y && r.CreatedAt.Month == m).ToList();
            int returnSlipCount = returnsInMonth.Count;
            decimal retQty = returnsInMonth.Sum(r => r.Items.Sum(it =>
                it.Quantity / (it.ConversionRate > 0 ? it.ConversionRate : 1m)));
            decimal retVal = returnsInMonth.Sum(r => r.Items.Sum(it =>
                it.Quantity / (it.ConversionRate > 0 ? it.ConversionRate : 1m)
                * baseUnitPriceMap.GetValueOrDefault(it.MaterialId, 0m)));

            var actionsInMonth = surplusActionList.Where(a => a.ActionDate.Year == y && a.ActionDate.Month == m).ToList();
            decimal surplusProcQty = actionsInMonth.Sum(a => a.Quantity);
            decimal finRecVal = actionsInMonth.Sum(a => a.FinancialValueVnd ?? 0);

            monthlyTrends.Add(new ReturnAndSurplusMonthlyTrendDto
            {
                Year = y,
                Month = m,
                MonthLabel = monthLabel,
                ReturnSlipCount = returnSlipCount,
                ReturnQuantity = retQty,
                ReturnEstimatedValueVnd = retVal,
                SurplusProcessedQuantity = surplusProcQty,
                FinancialRecoveryAmountVnd = finRecVal
            });
        }

        // 9. Top Returned Materials
        var topReturnedMaterials = returnList.SelectMany(r => r.Items)
            .GroupBy(it => it.MaterialId)
            .Select(g =>
            {
                var first = g.First();
                var totalBaseQty = g.Sum(x => x.Quantity / (x.ConversionRate > 0 ? x.ConversionRate : 1m));
                var baseUnitPrice = baseUnitPriceMap.GetValueOrDefault(g.Key, 0m);
                return new TopReturnedMaterialDto
                {
                    MaterialId = g.Key,
                    MaterialCode = first.Material?.Code ?? string.Empty,
                    MaterialName = first.Material?.Name ?? string.Empty,
                    UnitName = first.Material?.BaseUnit?.UnitName ?? first.Unit?.UnitName ?? string.Empty,
                    TotalQuantity = totalBaseQty,
                    EstimatedValueVnd = totalBaseQty * baseUnitPrice,
                    ReturnCount = g.Count()
                };
            })
            .OrderByDescending(x => x.EstimatedValueVnd > 0 ? x.EstimatedValueVnd : x.TotalQuantity)
            .Take(10)
            .ToList();

        // 10. Cross Project Matrix (when all projects or general comparison)
        var allAccessibleProjects = await _unitOfWork.Repository<Project>().Query()
            .AsNoTracking()
            .Where(p => accessibleIds.Contains(p.ProjectId) && p.Status != "draft")
            .ToListAsync(cancellationToken);

        var crossProjectMatrix = allAccessibleProjects.Select(p =>
        {
            var pReturns = returnList.Where(r => r.OriginalIssuance?.Task?.Phase?.ProjectId == p.ProjectId).ToList();
            var pSurplusItems = allSurplusItems.Where(x => x.Batch.ProjectId == p.ProjectId).ToList();
            var pActions = surplusActionList.Where(a => a.ProjectId == p.ProjectId).ToList();

            int retSlips = pReturns.Count;
            decimal retVal = pReturns.Sum(r => r.Items.Sum(it =>
                it.Quantity / (it.ConversionRate > 0 ? it.ConversionRate : 1m)
                * baseUnitPriceMap.GetValueOrDefault(it.MaterialId, 0m)));
            int sCount = pSurplusItems.Count;
            int sResolvedCount = pSurplusItems.Count(x =>
                x.Item.ProcessedQuantity >= x.Item.Quantity ||
                x.Item.Status == "Completed" ||
                x.Item.Status == "Closed");
            decimal sTotalQty = pSurplusItems.Sum(x => x.Item.Quantity);
            decimal sProcQty = pSurplusItems.Sum(x => x.Item.ProcessedQuantity);
            decimal sResRate = sCount > 0 ? Math.Min(100, Math.Round(((decimal)sResolvedCount / sCount) * 100, 1)) : 0;
            decimal finRec = pActions.Sum(a => a.FinancialValueVnd ?? 0);

            return new ProjectSurplusComparisonDto
            {
                ProjectId = p.ProjectId,
                ProjectName = p.Name,
                ReturnSlipCount = retSlips,
                ReturnEstimatedValueVnd = retVal,
                SurplusItemCount = sCount,
                SurplusResolvedItemCount = sResolvedCount,
                SurplusTotalQuantity = sTotalQty,
                SurplusProcessedQuantity = sProcQty,
                SurplusResolutionRatePercent = sResRate,
                FinancialRecoveryAmountVnd = finRec
            };
        })
        .OrderByDescending(p => p.SurplusItemCount + p.ReturnSlipCount)
        .ToList();

        int totalTransferredMaterialsCount = surplusActionList.Where(a => a.ActionType == "Transfer").Select(a => a.MaterialCode).Distinct().Count();
        int totalSurplusDistinctMaterialsCount = allSurplusItems.Select(x => x.Item.MaterialId).Distinct().Count();

        var result = new MaterialReturnsAndSurplusReportDto
        {
            ProjectId = request.ProjectId,
            ProjectName = projectName,
            GeneratedAt = DateTime.UtcNow,
            FromDate = request.FromDate,
            ToDate = request.ToDate,

            TotalReturnSlips = totalReturnSlips,
            TotalReturnItemsCount = totalReturnItemsCount,
            TotalReturnDistinctMaterialsCount = totalReturnDistinctMaterialsCount,
            TotalReturnVolume = totalReturnVolume,
            TotalReturnEstimatedValue = totalReturnEstimatedValue,

            TotalSurplusBatches = totalSurplusBatches,
            TotalSurplusItems = totalSurplusItems,
            TotalSurplusDistinctMaterialsCount = totalSurplusDistinctMaterialsCount,
            TotalSurplusResolvedItemsCount = totalSurplusResolvedItemsCount,
            TotalSurplusPendingItemsCount = totalSurplusPendingItemsCount,
            TotalSurplusQuantity = totalSurplusQuantity,
            TotalSurplusProcessedQuantity = totalSurplusProcessedQuantity,
            TotalSurplusRemainingQuantity = totalSurplusRemainingQuantity,
            SurplusResolutionRatePercent = surplusResolutionRatePercent,

            TotalFinancialRecoveryAmount = totalFinancialRecoveryAmount,
            TotalSupplierRefundAmount = totalSupplierRefundAmount,
            TotalLiquidationAmount = totalLiquidationAmount,
            TotalTransferredQuantity = totalTransferredQuantity,
            TotalTransferredActionsCount = totalTransferredActionsCount,
            TotalTransferredItemsCount = totalTransferredItemsCount,
            TotalTransferredMaterialsCount = totalTransferredMaterialsCount,

            SurplusMethodBreakdown = surplusMethodBreakdown,
            MonthlyTrends = monthlyTrends,
            TopReturnedMaterials = topReturnedMaterials,
            CrossProjectMatrix = crossProjectMatrix,

            MaterialReturns = returnReportItems,
            SurplusRequests = surplusRequestReportItems,
            SurplusActions = surplusActionList.OrderByDescending(a => a.ActionDate).ToList()
        };

        return ApiResponse<MaterialReturnsAndSurplusReportDto>.SuccessResult(result);
    }
}
