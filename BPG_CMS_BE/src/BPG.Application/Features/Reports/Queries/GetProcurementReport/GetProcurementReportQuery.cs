using BPG.Application.IRepositories;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Reports.Queries.GetProcurementReport;

public record GetProcurementReportQuery(long ProjectId)
    : IRequest<ApiResponse<ProcurementReportDto>>
{
}

public class GetProcurementReportQueryHandler
    : IRequestHandler<GetProcurementReportQuery, ApiResponse<ProcurementReportDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetProcurementReportQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse<ProcurementReportDto>> Handle(
        GetProcurementReportQuery request, CancellationToken cancellationToken)
    {
        // Fetch POs linked to this project via MaterialRequest → Phase → Project
        var pos = await _unitOfWork.Repository<PurchaseOrder>()
            .Query()
            .Include(p => p.Supplier)
            .Include(p => p.Items)
            .Include(p => p.Request).ThenInclude(r => r!.Phase)
            .Where(p =>
                ((p.ProjectId == request.ProjectId) ||
                 (p.Request != null && p.Request.Phase!.ProjectId == request.ProjectId))
                && p.RequestId != null // Exclude POs auto-generated from Direct Purchases
                && p.Status != "Draft" && p.Status != "Cancelled") // Only active POs
            .OrderByDescending(p => p.OrderDate)
            .ToListAsync(cancellationToken);

        // Direct Purchases
        var dps = await _unitOfWork.Repository<DirectPurchaseRequest>()
            .Query()
            .Include(d => d.Requester)
            .Include(d => d.Items)
            .Where(d => d.ProjectId == request.ProjectId && d.Status == "Approved") // Only approved direct purchases
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

