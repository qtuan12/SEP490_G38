using BPG.Application.IRepositories;
using BPG.Application.IServices;
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

        var poQuery = _unitOfWork.Repository<PurchaseOrder>()
            .Query()
            .Include(p => p.Supplier)
            .Include(p => p.Items)
            .Include(p => p.Request).ThenInclude(r => r!.Phase)
            // Đơn chưa được Giám đốc duyệt (hoặc bị từ chối) chưa phải cam kết chi — không đưa vào báo cáo.
            .Where(p => p.Status != PurchaseOrderStatus.Draft
                     && p.Status != PurchaseOrderStatus.PendingApproval
                     && p.Status != PurchaseOrderStatus.Rejected
                     && p.Status != PurchaseOrderStatus.Cancelled)
            .AsNoTracking();

        var fromDt = request.FromDate?.Date;
        var toDt = request.ToDate?.Date.AddDays(1).AddTicks(-1);

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
            SupplierName = p.Supplier?.SupplierName,
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

        if (fromDt.HasValue)
        {
            startMonth = fromDt.Value;
            endMonth = toDt ?? now;
        }
        else
        {
            var poMin = pos.Any() ? pos.Min(p => p.OrderDate) : now;
            var dpMin = dps.Any() ? dps.Min(d => d.PurchaseDate) : now;
            var minDt = poMin < dpMin ? poMin : dpMin;
            int startYear = Math.Min(minDt.Year, now.Year);
            startMonth = new DateTime(startYear, 1, 1);
            endMonth = toDt ?? new DateTime(now.Year, 12, 31);
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

        var avgPricesMap = await _unitOfWork.Repository<PurchaseOrderItem>()
            .Query()
            .Where(p => p.UnitPrice > 0
                && p.PurchaseOrder!.Status != PurchaseOrderStatus.Draft
                && p.PurchaseOrder.Status != PurchaseOrderStatus.PendingApproval
                && p.PurchaseOrder.Status != PurchaseOrderStatus.Rejected
                && p.PurchaseOrder.Status != PurchaseOrderStatus.Cancelled
                && (request.ProjectId > 0
                    ? p.PurchaseOrder.ProjectId == request.ProjectId
                    : accessibleIds.Contains(p.PurchaseOrder.ProjectId)))
            .GroupBy(p => p.MaterialId)
            .Select(g => new
            {
                MaterialId = g.Key,
                AvgPrice = g.Average(x => x.UnitPrice / (x.ConversionRate > 0 ? x.ConversionRate : 1m))
            })
            .ToDictionaryAsync(x => x.MaterialId, x => x.AvgPrice, cancellationToken);

        decimal totalMaterialIssuanceVal = issuanceItems.Sum(i =>
        {
            var price = avgPricesMap.GetValueOrDefault(i.MaterialId, 0m);
            return i.Quantity * (i.ConversionRate > 0 ? i.ConversionRate : 1m) * price;
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

