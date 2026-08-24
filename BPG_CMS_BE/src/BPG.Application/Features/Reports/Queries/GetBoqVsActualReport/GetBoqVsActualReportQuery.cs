
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Helpers;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TaskStatus = BPG.Domain.Constants.TaskStatus;

namespace BPG.Application.Features.Reports.Queries.GetBoqVsActualReport;

public record GetBoqVsActualReportQuery(long ProjectId, DateTime? FromDate = null, DateTime? ToDate = null)
    : IRequest<ApiResponse<BoqVsActualReportDto>>;

public class GetBoqVsActualReportQueryHandler : IRequestHandler<GetBoqVsActualReportQuery, ApiResponse<BoqVsActualReportDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProjectAccessService _projectAccessService;

    public GetBoqVsActualReportQueryHandler(IUnitOfWork unitOfWork, IProjectAccessService projectAccessService)
    {
        _unitOfWork = unitOfWork;
        _projectAccessService = projectAccessService;
    }

    public async Task<ApiResponse<BoqVsActualReportDto>> Handle(GetBoqVsActualReportQuery request, CancellationToken cancellationToken)
    {
        var accessibleIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
        if (request.ProjectId > 0 && !accessibleIds.Contains(request.ProjectId))
        {
            throw new BPG.Domain.Exceptions.BusinessException("ERR_FORBIDDEN", "Bạn không có quyền xem báo cáo của dự án này.");
        }

        var boqQuery = _unitOfWork.Repository<BOQItem>()
            .Query()
            .Include(b => b.Material)
                .ThenInclude(m => m.BaseUnit)
            .AsNoTracking();

        if (request.ProjectId > 0)
        {
            boqQuery = boqQuery.Where(b => b.Phase!.ProjectId == request.ProjectId);
        }
        else
        {
            boqQuery = boqQuery.Where(b => accessibleIds.Contains(b.Phase!.ProjectId));
        }

        var boqItems = await boqQuery.ToListAsync(cancellationToken);

        var boqGrouped = boqItems
            .GroupBy(b => b.MaterialId)
            .Select(g => new {
                MaterialId = g.Key,
                MaterialCode = g.First().Material.Code,
                MaterialName = g.First().Material.Name,
                UnitName = g.First().Material.BaseUnit?.UnitName ?? string.Empty,
                BoqLimit = g.Sum(x => x.Quantity / (x.ConversionRate > 0 ? x.ConversionRate : 1m))
            })
            .ToList();

        var invQuery = _unitOfWork.Repository<CurrentInventory>()
            .Query()
            .AsNoTracking();

        if (request.ProjectId > 0)
        {
            invQuery = invQuery.Where(i => i.ProjectId == request.ProjectId);
        }
        else
        {
            invQuery = invQuery.Where(i => accessibleIds.Contains(i.ProjectId));
        }

        var inventories = await invQuery.ToListAsync(cancellationToken);

        // Fetch issuances for actual usage (normalized by ConversionRate)
        var issuanceQuery = _unitOfWork.Repository<MaterialIssuanceItem>()
            .Query()
            .Include(i => i.Issuance).ThenInclude(i => i.Task).ThenInclude(t => t.Phase)
            .AsNoTracking();

        var dateRange = ReportDateRange.Create(request.FromDate, request.ToDate);
        var fromDt = dateRange.From;
        var toDt = dateRange.ToInclusive;

        var stockRemainingMap = inventories
            .GroupBy(inventory => inventory.MaterialId)
            .ToDictionary(group => group.Key, group => group.Sum(inventory => inventory.Quantity));
        if (toDt.HasValue)
        {
            var futureTransactionQuery = _unitOfWork.Repository<InventoryTransaction>()
                .Query()
                .AsNoTracking()
                .Where(transaction => transaction.CreatedAt > toDt.Value);
            futureTransactionQuery = request.ProjectId > 0
                ? futureTransactionQuery.Where(transaction => transaction.ProjectId == request.ProjectId)
                : futureTransactionQuery.Where(transaction => accessibleIds.Contains(transaction.ProjectId));

            var futureChanges = await futureTransactionQuery
                .GroupBy(transaction => transaction.MaterialId)
                .Select(group => new
                {
                    MaterialId = group.Key,
                    QuantityChange = group.Sum(transaction => transaction.QuantityChange)
                })
                .ToListAsync(cancellationToken);
            foreach (var futureChange in futureChanges)
            {
                stockRemainingMap[futureChange.MaterialId] =
                    stockRemainingMap.GetValueOrDefault(futureChange.MaterialId) - futureChange.QuantityChange;
            }
        }

        if (request.ProjectId > 0)
        {
            issuanceQuery = issuanceQuery.Where(i => i.Issuance!.Task.Phase.ProjectId == request.ProjectId);
        }
        else
        {
            issuanceQuery = issuanceQuery.Where(i => accessibleIds.Contains(i.Issuance!.Task.Phase.ProjectId));
        }

        if (fromDt.HasValue)
        {
            issuanceQuery = issuanceQuery.Where(i => i.Issuance!.CreatedAt >= fromDt.Value);
        }
        if (toDt.HasValue)
        {
            issuanceQuery = issuanceQuery.Where(i => i.Issuance!.CreatedAt <= toDt.Value);
        }

        var issuanceItems = await issuanceQuery.ToListAsync(cancellationToken);

        var issuedGrouped = issuanceItems
            .GroupBy(i => i.MaterialId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity / (x.ConversionRate > 0 ? x.ConversionRate : 1m)));

        // Fetch returns (normalized by ConversionRate)
        var returnQuery = _unitOfWork.Repository<MaterialReturnItem>()
            .Query()
            .Include(r => r.Return)
                .ThenInclude(ret => ret.OriginalIssuance)
                    .ThenInclude(iss => iss.Task)
                        .ThenInclude(t => t.Phase)
            .AsNoTracking();

        if (request.ProjectId > 0)
        {
            returnQuery = returnQuery.Where(r => r.Return.OriginalIssuance.Task.Phase.ProjectId == request.ProjectId);
        }
        else
        {
            returnQuery = returnQuery.Where(r => accessibleIds.Contains(r.Return.OriginalIssuance.Task.Phase.ProjectId));
        }

        if (fromDt.HasValue)
        {
            returnQuery = returnQuery.Where(r => r.Return.CreatedAt >= fromDt.Value);
        }
        if (toDt.HasValue)
        {
            returnQuery = returnQuery.Where(r => r.Return.CreatedAt <= toDt.Value);
        }

        var returnItems = await returnQuery.ToListAsync(cancellationToken);
        var returnedGrouped = returnItems
            .GroupBy(r => r.MaterialId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity / (x.ConversionRate > 0 ? x.ConversionRate : 1m)));

        // Pending POs
        var poQuery = _unitOfWork.Repository<PurchaseOrderItem>()
            .Query()
            .Include(p => p.PurchaseOrder).ThenInclude(po => po!.Request).ThenInclude(r => r!.Phase)
            .Where(p => (p.PurchaseOrder!.Status == PurchaseOrderStatus.Sent || p.PurchaseOrder.Status == PurchaseOrderStatus.PartiallyReceived))
            .AsNoTracking();

        if (request.ProjectId > 0)
        {
            poQuery = poQuery.Where(p => p.PurchaseOrder!.Request!.Phase!.ProjectId == request.ProjectId);
        }
        else
        {
            poQuery = poQuery.Where(p => accessibleIds.Contains(p.PurchaseOrder!.Request!.Phase!.ProjectId));
        }

        var activePoItems = await poQuery.ToListAsync(cancellationToken);

        var poIds = activePoItems.Select(pi => pi.POId).Distinct().ToList();

        var receivedMap = poIds.Count == 0
            ? new Dictionary<(long POId, long MaterialId), decimal>()
            : await _unitOfWork.Repository<GoodsReceiptItem>()
                .Query()
                .Where(gri => poIds.Contains(gri.Receipt.POId) && gri.Receipt.Status == GoodsReceiptStatus.Approved)
                .GroupBy(gri => new { POId = gri.Receipt.POId, gri.MaterialId })
                .Select(g => new { g.Key.POId, g.Key.MaterialId, Total = g.Sum(x => x.Quantity / (x.ConversionRate > 0 ? x.ConversionRate : 1m)) })
                .ToDictionaryAsync(x => (x.POId, x.MaterialId), x => x.Total, cancellationToken);

        var poGrouped = activePoItems
            .GroupBy(p => p.MaterialId)
            .ToDictionary(
                g => g.Key,
                g => g.Sum(pi =>
                {
                    decimal poQtyNormalized = pi.Quantity / (pi.ConversionRate > 0 ? pi.ConversionRate : 1m);
                    receivedMap.TryGetValue((pi.POId, pi.MaterialId), out var recQty);
                    return Math.Max(0, poQtyNormalized - recQty);
                })
            );

        // Pending MRs
        var mrQuery = _unitOfWork.Repository<MaterialRequestItem>()
            .Query()
            .Include(m => m.Request).ThenInclude(r => r.Phase)
            .Where(m => m.Request!.Status == MaterialRequestStatus.Pending || m.Request.Status == MaterialRequestStatus.WaitingApproval)
            .AsNoTracking();

        if (request.ProjectId > 0)
        {
            mrQuery = mrQuery.Where(m => m.Request!.Phase.ProjectId == request.ProjectId);
        }
        else
        {
            mrQuery = mrQuery.Where(m => accessibleIds.Contains(m.Request!.Phase.ProjectId));
        }

        var mrItems = await mrQuery.ToListAsync(cancellationToken);

        var mrGrouped = mrItems
            .GroupBy(m => m.MaterialId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity / (x.ConversionRate > 0 ? x.ConversionRate : 1m)));

        // A Direct Purchase technical PO is FullyReceived before the payment decision.
        // Do not let pending/rejected emergency purchases affect monetary BOQ values.
        var nonApprovedAutoPoQuery = _unitOfWork.Repository<DirectPurchaseRequest>()
            .Query()
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(d => d.AutoPOId.HasValue && d.Status != DirectPurchaseStatus.Approved);
        nonApprovedAutoPoQuery = request.ProjectId > 0
            ? nonApprovedAutoPoQuery.Where(d => d.ProjectId == request.ProjectId)
            : nonApprovedAutoPoQuery.Where(d => accessibleIds.Contains(d.ProjectId));
        var nonApprovedAutoPoIds = await nonApprovedAutoPoQuery
            .Select(d => d.AutoPOId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

        // Fetch average unit prices from financially valid PO items
        var priceQuery = _unitOfWork.Repository<PurchaseOrderItem>()
            .Query()
            .Where(p => p.UnitPrice > 0
                && p.PurchaseOrder!.Status != PurchaseOrderStatus.Draft
                && p.PurchaseOrder.Status != PurchaseOrderStatus.PendingApproval
                && p.PurchaseOrder.Status != PurchaseOrderStatus.Rejected
                && p.PurchaseOrder.Status != PurchaseOrderStatus.Cancelled
                && !nonApprovedAutoPoIds.Contains(p.POId)
                && (request.ProjectId > 0
                    ? p.PurchaseOrder.ProjectId == request.ProjectId
                    : accessibleIds.Contains(p.PurchaseOrder.ProjectId)));
        if (toDt.HasValue)
        {
            priceQuery = priceQuery.Where(p => p.PurchaseOrder!.OrderDate <= toDt.Value);
        }

        var priceTotals = await priceQuery
            .GroupBy(p => p.MaterialId)
            .Select(g => new
            {
                MaterialId = g.Key,
                TotalBaseQuantity = g.Sum(x => x.Quantity / (x.ConversionRate > 0 ? x.ConversionRate : 1m)),
                TotalValue = g.Sum(x => x.Quantity * x.UnitPrice)
            })
            .ToListAsync(cancellationToken);
        var avgPricesMap = priceTotals.ToDictionary(
            total => total.MaterialId,
            total => total.TotalBaseQuantity > 0
                ? total.TotalValue / total.TotalBaseQuantity
                : 0m);

        // Fetch project overall progress for Earned BOQ Calculation
        var taskQuery = _unitOfWork.Repository<ProjectTask>().Query().AsNoTracking();
        if (request.ProjectId > 0)
        {
            taskQuery = taskQuery.Where(t => t.Phase.ProjectId == request.ProjectId);
        }
        else
        {
            taskQuery = taskQuery.Where(t => accessibleIds.Contains(t.Phase.ProjectId));
        }
        var validTasks = await taskQuery.Where(t => t.Status != TaskStatus.Obsolete).ToListAsync(cancellationToken);
        decimal overallProgress = ProgressCalculator.CalculateWeightedProgress(validTasks);

        var itemsList = new List<BoqVsActualItemDto>();

        foreach (var boq in boqGrouped)
        {
            var issued = issuedGrouped.ContainsKey(boq.MaterialId) ? issuedGrouped[boq.MaterialId] : 0;
            var returned = returnedGrouped.ContainsKey(boq.MaterialId) ? returnedGrouped[boq.MaterialId] : 0;
            var price = avgPricesMap.GetValueOrDefault(boq.MaterialId, 0m);

            var item = new BoqVsActualItemDto
            {
                MaterialId = boq.MaterialId,
                MaterialCode = boq.MaterialCode,
                MaterialName = boq.MaterialName,
                UnitName = boq.UnitName,
                UnitPrice = price,
                OriginalBoqUnitPrice = price,
                BoqLimit = boq.BoqLimit,
                OverallProgressPercent = overallProgress,
                TotalIssued = issued,
                TotalReturned = returned,
                StockRemaining = stockRemainingMap.GetValueOrDefault(boq.MaterialId),
                PendingPoQuantity = poGrouped.ContainsKey(boq.MaterialId) ? poGrouped[boq.MaterialId] : 0,
                PendingMrQuantity = mrGrouped.ContainsKey(boq.MaterialId) ? mrGrouped[boq.MaterialId] : 0
            };
            itemsList.Add(item);
        }

        int totalCount = itemsList.Count;
        int exceedingCount = itemsList.Count(i => i.IsExceeding);
        int earnedExceedingCount = itemsList.Count(i => i.IsEarnedExceeding);
        int savingCount = itemsList.Count(i => i.NetConsumption < i.BoqLimit && i.NetConsumption > 0);
        int normalCount = totalCount - exceedingCount - savingCount;

        decimal totalBoqVal = itemsList.Sum(i => i.BoqTotalValue);
        decimal totalConsVal = itemsList.Sum(i => i.ConsumptionValue);
        decimal totalVarVal = itemsList.Sum(i => i.VarianceValue);

        // Monthly BOQ Consumption Trends (Full Calendar Year T01 -> T12 & Multi-year History)
        var now = DateTime.UtcNow;
        DateTime startMonth;
        DateTime endMonth;

        var project = (request.ProjectId > 0 && _unitOfWork.Repository<Project>() != null)
            ? await _unitOfWork.Repository<Project>().GetByIdAsync(request.ProjectId, cancellationToken)
            : null;
        bool isProjectFinished = project != null && (project.Status == ProjectStatus.Completed || project.Status == ProjectStatus.Closed);

        if (fromDt.HasValue)
        {
            startMonth = fromDt.Value;
            endMonth = toDt ?? now;
        }
        else if (isProjectFinished)
        {
            var issMin = issuanceItems.Any() ? issuanceItems.Min(i => i.Issuance!.CreatedAt).Year : project!.PlannedStart.Year;
            var issMax = issuanceItems.Any() ? issuanceItems.Max(i => i.Issuance!.CreatedAt).Year : project!.PlannedEnd.Year;
            int startYear = Math.Min(issMin, issMax);
            int endYear = Math.Max(issMin, issMax);
            startMonth = new DateTime(startYear, 1, 1);
            endMonth = toDt ?? new DateTime(endYear, 12, 31);
        }
        else
        {
            var issMin = issuanceItems.Any() ? issuanceItems.Min(i => i.Issuance!.CreatedAt) : now;
            int startYear = Math.Min(issMin.Year, now.Year);
            startMonth = new DateTime(startYear, 1, 1);
            endMonth = toDt ?? new DateTime(now.Year, 12, 31);
        }

        var currentM = new DateTime(startMonth.Year, startMonth.Month, 1);
        var targetM = new DateTime(endMonth.Year, endMonth.Month, 1);
        var monthlyBoqTrends = new List<MonthlyBoqConsumptionTrendDto>();

        while (currentM <= targetM)
        {
            var mStart = currentM;
            var mEnd = currentM.AddMonths(1).AddTicks(-1);

            var monthIssuance = issuanceItems.Where(i => i.Issuance!.CreatedAt >= mStart && i.Issuance.CreatedAt <= mEnd).ToList();
            var monthReturn = returnItems.Where(r => r.Return.CreatedAt >= mStart && r.Return.CreatedAt <= mEnd).ToList();

            decimal consumedVal = monthIssuance.Sum(i =>
            {
                var price = avgPricesMap.GetValueOrDefault(i.MaterialId, 0m);
                var qty = i.Quantity / (i.ConversionRate > 0 ? i.ConversionRate : 1m);
                return qty * price;
            }) - monthReturn.Sum(r =>
            {
                var price = avgPricesMap.GetValueOrDefault(r.MaterialId, 0m);
                var qty = r.Quantity / (r.ConversionRate > 0 ? r.ConversionRate : 1m);
                return qty * price;
            });

            monthlyBoqTrends.Add(new MonthlyBoqConsumptionTrendDto
            {
                Year = currentM.Year,
                Month = currentM.Month,
                MonthLabel = $"T{currentM.Month:D2}/{currentM.Year}",
                MaterialRequestCount = monthIssuance.Select(i => i.MaterialIssuanceId).Distinct().Count(),
                ConsumedValueVnd = Math.Max(0m, consumedVal)
            });

            currentM = currentM.AddMonths(1);
        }

        var reportDto = new BoqVsActualReportDto
        {
            ProjectId = request.ProjectId,
            OverallProgressPercent = overallProgress,
            TotalBoqItemsCount = totalCount,
            ExceedingItemsCount = exceedingCount,
            EarnedExceedingItemsCount = earnedExceedingCount,
            SavingItemsCount = savingCount,
            NormalItemsCount = normalCount,
            TotalBoqValue = totalBoqVal,
            TotalConsumptionValue = totalConsVal,
            TotalVarianceValue = totalVarVal,
            Items = itemsList,
            MonthlyTrends = monthlyBoqTrends
        };

        return ApiResponse<BoqVsActualReportDto>.SuccessResult(reportDto);
    }
}

