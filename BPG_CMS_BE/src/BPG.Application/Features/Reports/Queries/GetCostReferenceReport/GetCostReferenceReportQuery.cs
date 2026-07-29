
using BPG.Application.IRepositories;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
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

    public GetCostReferenceReportQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse<CostReferenceReportDto>> Handle(GetCostReferenceReportQuery request, CancellationToken cancellationToken)
    {
        // PO Cost
        var pos = await _unitOfWork.Repository<PurchaseOrder>()
            .Query()
            .Include(p => p.Items)
            .Include(p => p.Request).ThenInclude(r => r!.Phase)
            .Where(p => p.Request!.Phase!.ProjectId == request.ProjectId && (p.Status == "Sent" || p.Status == "PartiallyReceived" || p.Status == "FullyReceived" || p.Status == "Closed"))
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
            .Where(d => d.ProjectId == request.ProjectId && d.Status == "Approved")
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

