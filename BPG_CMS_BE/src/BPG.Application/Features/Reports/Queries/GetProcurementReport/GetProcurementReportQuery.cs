using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Helpers;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Reports.Queries.GetProcurementReport;

public record GetProcurementReportQuery(long ProjectId, DateTime? FromDate = null, DateTime? ToDate = null)
    : IRequest<ApiResponse<ProcurementReportDto>>;

public class GetProcurementReportQueryHandler
    : IRequestHandler<GetProcurementReportQuery, ApiResponse<ProcurementReportDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProjectAccessService _projectAccessService;

    public GetProcurementReportQueryHandler(
        IUnitOfWork unitOfWork,
        IProjectAccessService projectAccessService)
    {
        _unitOfWork = unitOfWork;
        _projectAccessService = projectAccessService;
    }

    public async Task<ApiResponse<ProcurementReportDto>> Handle(
        GetProcurementReportQuery request, CancellationToken cancellationToken)
    {
        var accessibleIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
        if (request.ProjectId > 0 && !accessibleIds.Contains(request.ProjectId))
        {
            throw new BPG.Domain.Exceptions.BusinessException("ERR_FORBIDDEN", "Bạn không có quyền xem báo cáo của dự án này.");
        }

        // Approved direct purchases create a technical PO/receipt for inventory
        // traceability. Those auto POs must not be counted again as normal procurement.
        var autoPoQuery = _unitOfWork.Repository<DirectPurchaseRequest>()
            .Query()
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(d => d.AutoPOId.HasValue);
        autoPoQuery = request.ProjectId > 0
            ? autoPoQuery.Where(d => d.ProjectId == request.ProjectId)
            : autoPoQuery.Where(d => accessibleIds.Contains(d.ProjectId));
        var autoPoIds = await autoPoQuery
            .Select(d => d.AutoPOId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

        var poQuery = _unitOfWork.Repository<PurchaseOrder>()
            .Query()
            .Include(p => p.Supplier)
            .Include(p => p.Items)
            .Include(p => p.Request).ThenInclude(r => r!.Phase)
            // Đơn chưa được Giám đốc duyệt (hoặc bị từ chối) chưa phải cam kết chi — không đưa vào báo cáo.
            .Where(p => p.Status != PurchaseOrderStatus.Draft
                     && p.Status != PurchaseOrderStatus.PendingApproval
                     && p.Status != PurchaseOrderStatus.Rejected
                     && p.Status != PurchaseOrderStatus.Cancelled
                     && !autoPoIds.Contains(p.POId))
            .AsNoTracking();

        var dateRange = ReportDateRange.Create(request.FromDate, request.ToDate);
        var fromDt = dateRange.From;
        var toDt = dateRange.ToInclusive;

        if (request.ProjectId > 0)
        {
            poQuery = poQuery.Where(p => p.ProjectId == request.ProjectId);
        }
        else
        {
            poQuery = poQuery.Where(p => accessibleIds.Contains(p.ProjectId));
        }

        if (fromDt.HasValue)
        {
            poQuery = poQuery.Where(p => p.OrderDate >= fromDt.Value);
        }
        if (toDt.HasValue)
        {
            poQuery = poQuery.Where(p => p.OrderDate <= toDt.Value);
        }

        var pos = await poQuery
            .OrderByDescending(p => p.OrderDate)
            .ToListAsync(cancellationToken);

        var dpQuery = _unitOfWork.Repository<DirectPurchaseRequest>()
            .Query()
            .Include(d => d.Requester)
            .Include(d => d.Items)
            .Where(d => d.Status == DirectPurchaseStatus.Approved)
            .AsNoTracking();

        if (request.ProjectId > 0)
        {
            dpQuery = dpQuery.Where(d => d.ProjectId == request.ProjectId);
        }
        else
        {
            dpQuery = dpQuery.Where(d => accessibleIds.Contains(d.ProjectId));
        }

        if (fromDt.HasValue)
        {
            dpQuery = dpQuery.Where(d => d.PurchaseDate >= fromDt.Value);
        }
        if (toDt.HasValue)
        {
            dpQuery = dpQuery.Where(d => d.PurchaseDate <= toDt.Value);
        }

        var dps = await dpQuery
            .OrderByDescending(d => d.PurchaseDate)
            .ToListAsync(cancellationToken);

        // A technical PO exists as soon as an emergency purchase is submitted and is
        // always FullyReceived. Until the source request is Approved, that PO must not
        // influence any monetary valuation in the report.
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

        var supplierIds = pos
            .Where(po => po.SupplierId.HasValue)
            .Select(po => po.SupplierId!.Value)
            .Distinct()
            .ToList();
        var supplierNames = supplierIds.Count == 0
            ? new Dictionary<long, string>()
            : await _unitOfWork.Repository<Supplier>().Query()
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(supplier => supplierIds.Contains(supplier.SupplierId))
                .ToDictionaryAsync(supplier => supplier.SupplierId, supplier => supplier.SupplierName, cancellationToken);

        decimal totalPoCost = pos.Sum(p => p.TotalAmount > 0
            ? p.TotalAmount
            : p.Items.Sum(i => i.Quantity * i.UnitPrice));

        decimal totalDpCost = dps.Sum(d => d.TotalAmount > 0
            ? d.TotalAmount
            : d.Items.Sum(i => i.Quantity * i.UnitPrice));

        var poSummaries = pos.Select(p => new PurchaseOrderSummaryDto
        {
            POId = p.POId,
            PONumber = p.PONumber,
            Status = p.Status,
            SupplierName = p.SupplierId.HasValue
                && supplierNames.TryGetValue(p.SupplierId.Value, out var supplierName)
                    ? supplierName
                    : null,
            TotalAmount = p.TotalAmount > 0 ? p.TotalAmount : p.Items.Sum(i => i.Quantity * i.UnitPrice),
            OrderDate = p.OrderDate,
            ExpectedDeliveryDate = p.ExpectedDeliveryDate
        }).ToList();

        var dpSummaries = dps.Select(d => new DirectPurchaseSummaryDto
        {
            DirectPurchaseId = d.DirectPurchaseId,
            RequestedByName = d.Requester?.FullName ?? string.Empty,
            Status = d.Status,
            TotalAmount = d.TotalAmount > 0 ? d.TotalAmount : d.Items.Sum(i => i.Quantity * i.UnitPrice),
            CreatedAt = d.PurchaseDate
        }).ToList();

        // Calculate Monthly Procurement Trends (Full Calendar Year T01 -> T12 & Multi-year History)
        var now = DateTime.UtcNow;
        DateTime startMonth;
        DateTime endMonth;

        var project = (request.ProjectId > 0 && _unitOfWork.Repository<Project>() != null)
            ? await _unitOfWork.Repository<Project>().GetByIdAsync(request.ProjectId, cancellationToken)
            : null;
        bool isProjectFinished = project != null && (project.Status == ProjectStatus.Completed || project.Status == ProjectStatus.Closed);

        if (request.FromDate.HasValue)
        {
            startMonth = request.FromDate.Value.Date;
            endMonth = request.ToDate?.Date ?? now;
        }
        else if (isProjectFinished)
        {
            var poMin = pos.Any() ? pos.Min(p => p.OrderDate).Year : project!.PlannedStart.Year;
            var dpMin = dps.Any() ? dps.Min(d => d.PurchaseDate).Year : poMin;
            var poMax = pos.Any() ? pos.Max(p => p.OrderDate).Year : project!.PlannedEnd.Year;
            var dpMax = dps.Any() ? dps.Max(d => d.PurchaseDate).Year : poMax;

            int startYear = Math.Min(poMin, dpMin);
            int endYear = Math.Max(poMax, dpMax);
            startMonth = new DateTime(startYear, 1, 1);
            endMonth = request.ToDate?.Date ?? new DateTime(endYear, 12, 31);
        }
        else
        {
            var poMin = pos.Any() ? pos.Min(p => p.OrderDate) : now;
            var dpMin = dps.Any() ? dps.Min(d => d.PurchaseDate) : now;
            var minDt = poMin < dpMin ? poMin : dpMin;
            int startYear = Math.Min(minDt.Year, now.Year);
            startMonth = new DateTime(startYear, 1, 1);
            endMonth = request.ToDate?.Date ?? new DateTime(now.Year, 12, 31);
        }

        var currentM = new DateTime(startMonth.Year, startMonth.Month, 1);
        var targetM = new DateTime(endMonth.Year, endMonth.Month, 1);
        var monthlyProcurementTrends = new List<MonthlyProcurementTrendDto>();

        while (currentM <= targetM)
        {
            var mStart = currentM;
            var mEnd = currentM.AddMonths(1).AddTicks(-1);

            var monthPos = pos.Where(p => p.OrderDate >= mStart && p.OrderDate <= mEnd).ToList();
            var monthDps = dps.Where(d => d.PurchaseDate >= mStart && d.PurchaseDate <= mEnd).ToList();

            decimal poCost = monthPos.Sum(p => p.TotalAmount > 0 ? p.TotalAmount : p.Items.Sum(i => i.Quantity * i.UnitPrice));
            decimal dpCost = monthDps.Sum(d => d.TotalAmount > 0 ? d.TotalAmount : d.Items.Sum(i => i.Quantity * i.UnitPrice));

            monthlyProcurementTrends.Add(new MonthlyProcurementTrendDto
            {
                Year = currentM.Year,
                Month = currentM.Month,
                MonthLabel = $"T{currentM.Month:D2}/{currentM.Year}",
                PoCostVnd = poCost,
                DirectPurchaseCostVnd = dpCost,
                PoCount = monthPos.Count
            });

            currentM = currentM.AddMonths(1);
        }

        // Fetch Material Issuance Value for Actual Construction Expense comparison
        var issuanceQuery = _unitOfWork.Repository<MaterialIssuanceItem>()
            .Query()
            .Include(i => i.Issuance).ThenInclude(iss => iss.Task).ThenInclude(t => t.Phase)
            .AsNoTracking();

        if (request.ProjectId > 0)
        {
            issuanceQuery = issuanceQuery.Where(i => i.Issuance!.Task.Phase.ProjectId == request.ProjectId);
        }
        else
        {
            issuanceQuery = issuanceQuery.Where(i => accessibleIds.Contains(i.Issuance!.Task.Phase.ProjectId));
        }

        if (fromDt.HasValue) issuanceQuery = issuanceQuery.Where(i => i.Issuance!.CreatedAt >= fromDt.Value);
        if (toDt.HasValue) issuanceQuery = issuanceQuery.Where(i => i.Issuance!.CreatedAt <= toDt.Value);

        var issuanceItems = await issuanceQuery.ToListAsync(cancellationToken);

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

        decimal totalMaterialIssuanceVal = issuanceItems.Sum(i =>
        {
            var price = avgPricesMap.GetValueOrDefault(i.MaterialId, 0m);
            return i.Quantity / (i.ConversionRate > 0 ? i.ConversionRate : 1m) * price;
        });

        var dto = new ProcurementReportDto
        {
            ProjectId = request.ProjectId,
            TotalPoCost = totalPoCost,
            TotalDirectPurchaseCost = totalDpCost,
            TotalMaterialIssuanceValue = totalMaterialIssuanceVal,
            TotalProcurementSavings = 0m,
            PurchaseOrders = poSummaries,
            DirectPurchases = dpSummaries,
            MonthlyTrends = monthlyProcurementTrends
        };

        return ApiResponse<ProcurementReportDto>.SuccessResult(dto);
    }
}
