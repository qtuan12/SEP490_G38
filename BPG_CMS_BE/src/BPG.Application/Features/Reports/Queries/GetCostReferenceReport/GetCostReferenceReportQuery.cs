
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Reports.Queries.GetCostReferenceReport;

public record GetCostReferenceReportQuery(long ProjectId)
    : IRequest<ApiResponse<CostReferenceReportDto>>
{
}

public class GetCostReferenceReportQueryHandler : IRequestHandler<GetCostReferenceReportQuery, ApiResponse<CostReferenceReportDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProjectAccessService _projectAccessService;

    public GetCostReferenceReportQueryHandler(
        IUnitOfWork unitOfWork,
        IProjectAccessService projectAccessService)
    {
        _unitOfWork = unitOfWork;
        _projectAccessService = projectAccessService;
    }

    public async Task<ApiResponse<CostReferenceReportDto>> Handle(GetCostReferenceReportQuery request, CancellationToken cancellationToken)
    {
        var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
        if (request.ProjectId > 0 && !accessibleProjectIds.Contains(request.ProjectId))
        {
            throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền truy cập báo cáo của dự án này.");
        }

        // Every submitted Direct Purchase creates a FullyReceived technical PO before
        // the payment decision. Exclude all of those POs here; only Approved Direct
        // Purchases are included below as company expenditure.
        var autoPoIds = await _unitOfWork.Repository<DirectPurchaseRequest>()
            .Query()
            .IgnoreQueryFilters()
            .Where(d => d.AutoPOId.HasValue)
            .Select(d => d.AutoPOId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

        // PO Cost
        var pos = await _unitOfWork.Repository<PurchaseOrder>()
            .Query()
            .Include(p => p.Items)
            .Include(p => p.Request).ThenInclude(r => r!.Phase)
            .Where(p => p.ProjectId == request.ProjectId
                && p.Status != PurchaseOrderStatus.Draft
                && p.Status != PurchaseOrderStatus.PendingApproval
                && p.Status != PurchaseOrderStatus.Rejected
                && p.Status != PurchaseOrderStatus.Cancelled
                && !autoPoIds.Contains(p.POId))
            .ToListAsync(cancellationToken);

        decimal totalPoCost = 0;
        foreach (var po in pos)
        {
            totalPoCost += po.Items.Sum(i => i.Quantity * i.UnitPrice);
        }

        // Direct Purchase Cost
        var dps = await _unitOfWork.Repository<DirectPurchaseRequest>()
            .Query()
            .Include(d => d.Items)
            .Where(d => d.ProjectId == request.ProjectId && d.Status == DirectPurchaseStatus.Approved)
            .ToListAsync(cancellationToken);

        decimal totalDpCost = 0;
        foreach (var dp in dps)
        {
            totalDpCost += dp.Items.Sum(i => i.Quantity * i.UnitPrice);
        }

        var dto = new CostReferenceReportDto
        {
            ProjectId = request.ProjectId,
            TotalPoCost = totalPoCost,
            TotalDirectPurchaseCost = totalDpCost
        };

        return ApiResponse<CostReferenceReportDto>.SuccessResult(dto);
    }
}

