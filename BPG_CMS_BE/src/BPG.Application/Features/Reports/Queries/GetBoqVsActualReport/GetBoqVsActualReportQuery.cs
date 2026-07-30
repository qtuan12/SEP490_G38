
using BPG.Application.IRepositories;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Reports.Queries.GetBoqVsActualReport;

public record GetBoqVsActualReportQuery(long ProjectId)
    : IRequest<ApiResponse<BoqVsActualReportDto>>
{
}

public class GetBoqVsActualReportQueryHandler : IRequestHandler<GetBoqVsActualReportQuery, ApiResponse<BoqVsActualReportDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetBoqVsActualReportQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse<BoqVsActualReportDto>> Handle(GetBoqVsActualReportQuery request, CancellationToken cancellationToken)
    {
        var boqItems = await _unitOfWork.Repository<BOQItem>()
            .Query()
            .Include(b => b.Material)
            .Include(b => b.Material.BaseUnit)
            .Where(b => b.Phase!.ProjectId == request.ProjectId)
            .ToListAsync(cancellationToken);

        var boqGrouped = boqItems
            .GroupBy(b => b.MaterialId)
            .Select(g => new {
                MaterialId = g.Key,
                MaterialCode = g.First().Material.Code,
                MaterialName = g.First().Material.Name,
                UnitName = g.First().Material.BaseUnit!.UnitName,
                BoqLimit = g.Sum(x => x.Quantity)
            })
            .ToList();

        var inventories = await _unitOfWork.Repository<CurrentInventory>()
            .Query()
            .Where(i => i.ProjectId == request.ProjectId)
            .ToListAsync(cancellationToken);

        // Fetch issuances for actual usage
        // Note: material issuance is mapped back to the project by standard practice.
        // The issuance items might be directly linked.
        var issuanceItems = await _unitOfWork.Repository<MaterialIssuanceItem>()
            .Query()
            .Include(i => i.Issuance).ThenInclude(i => i.Task).ThenInclude(t => t.Phase)
            .Where(i => i.Issuance!.Task.Phase.ProjectId == request.ProjectId)
            .ToListAsync(cancellationToken);

        var issuedGrouped = issuanceItems
            .GroupBy(i => i.MaterialId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));

        // Pending POs: Only count active POs (Sent or PartiallyReceived)
        var activePoItems = await _unitOfWork.Repository<PurchaseOrderItem>()
            .Query()
            .Include(p => p.PurchaseOrder).ThenInclude(po => po!.Request).ThenInclude(r => r!.Phase)
            .Where(p => p.PurchaseOrder!.Request!.Phase!.ProjectId == request.ProjectId
                     && (p.PurchaseOrder.Status == "Sent" || p.PurchaseOrder.Status == "PartiallyReceived"))
            .ToListAsync(cancellationToken);

        var poIds = activePoItems.Select(pi => pi.POId).Distinct().ToList();

        var receivedMap = poIds.Count == 0
            ? new Dictionary<(long POId, long MaterialId), decimal>()
            : await _unitOfWork.Repository<GoodsReceiptItem>()
                .Query()
                .Where(gri => poIds.Contains(gri.Receipt.POId) && gri.Receipt.Status == "Approved")
                .GroupBy(gri => new { POId = gri.Receipt.POId, gri.MaterialId })
                .Select(g => new { g.Key.POId, g.Key.MaterialId, Total = g.Sum(x => x.Quantity) })
                .ToDictionaryAsync(x => (x.POId, x.MaterialId), x => x.Total, cancellationToken);

        var poGrouped = activePoItems
            .GroupBy(p => p.MaterialId)
            .ToDictionary(
                g => g.Key,
                g => g.Sum(pi =>
                {
                    receivedMap.TryGetValue((pi.POId, pi.MaterialId), out var recQty);
                    return Math.Max(0, pi.Quantity - recQty);
                })
            );

        // Pending MRs
        var mrItems = await _unitOfWork.Repository<MaterialRequestItem>()
            .Query()
            .Include(m => m.Request).ThenInclude(r => r.Phase)
            .Where(m => m.Request!.Phase.ProjectId == request.ProjectId && m.Request.Status == "Pending")
            .ToListAsync(cancellationToken);

        var mrGrouped = mrItems
            .GroupBy(m => m.MaterialId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));

        var reportDto = new BoqVsActualReportDto { ProjectId = request.ProjectId };

        foreach (var boq in boqGrouped)
        {
            var item = new BoqVsActualItemDto
            {
                MaterialId = boq.MaterialId,
                MaterialCode = boq.MaterialCode,
                MaterialName = boq.MaterialName,
                UnitName = boq.UnitName,
                BoqLimit = boq.BoqLimit,
                TotalIssued = issuedGrouped.ContainsKey(boq.MaterialId) ? issuedGrouped[boq.MaterialId] : 0,
                StockRemaining = inventories.FirstOrDefault(i => i.MaterialId == boq.MaterialId)?.Quantity ?? 0,
                PendingPoQuantity = poGrouped.ContainsKey(boq.MaterialId) ? poGrouped[boq.MaterialId] : 0,
                PendingMrQuantity = mrGrouped.ContainsKey(boq.MaterialId) ? mrGrouped[boq.MaterialId] : 0
            };
            reportDto.Items.Add(item);
        }

        return ApiResponse<BoqVsActualReportDto>.SuccessResult(reportDto);
    }
}

