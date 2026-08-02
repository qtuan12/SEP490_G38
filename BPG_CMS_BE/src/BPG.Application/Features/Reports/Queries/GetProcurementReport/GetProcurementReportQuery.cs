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
            .Where(p => p.RequestId != null && p.Status != PurchaseOrderStatus.Draft && p.Status != PurchaseOrderStatus.Cancelled)
            .AsNoTracking();

        var fromDt = request.FromDate?.Date;
        var toDt = request.ToDate?.Date.AddDays(1).AddTicks(-1);

        if (request.ProjectId > 0)
        {
            poQuery = poQuery.Where(p => (p.ProjectId == request.ProjectId) || (p.Request != null && p.Request.Phase!.ProjectId == request.ProjectId));
        }
        else
        {
            poQuery = poQuery.Where(p => accessibleIds.Contains(p.ProjectId) || (p.Request != null && accessibleIds.Contains(p.Request.Phase!.ProjectId)));
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
            dpQuery = dpQuery.Where(d => d.CreatedAt >= fromDt.Value);
        }
        if (toDt.HasValue)
        {
            dpQuery = dpQuery.Where(d => d.CreatedAt <= toDt.Value);
        }

        var dps = await dpQuery
            .OrderByDescending(d => d.CreatedAt)
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
            CreatedAt = d.CreatedAt
        }).ToList();

        var dto = new ProcurementReportDto
        {
            ProjectId = request.ProjectId,
            TotalPoCost = totalPoCost,
            TotalDirectPurchaseCost = totalDpCost,
            PurchaseOrders = poSummaries,
            DirectPurchases = dpSummaries
        };

        return ApiResponse<ProcurementReportDto>.SuccessResult(dto);
    }
}

