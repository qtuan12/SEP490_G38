
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

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
                BoqLimit = g.Sum(x => x.Quantity * (x.ConversionRate > 0 ? x.ConversionRate : 1m))
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

        var fromDt = request.FromDate?.Date;
        var toDt = request.ToDate?.Date.AddDays(1).AddTicks(-1);

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
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity * (x.ConversionRate > 0 ? x.ConversionRate : 1m)));

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
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity * (x.ConversionRate > 0 ? x.ConversionRate : 1m)));

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
                .Select(g => new { g.Key.POId, g.Key.MaterialId, Total = g.Sum(x => x.Quantity * (x.ConversionRate > 0 ? x.ConversionRate : 1m)) })
                .ToDictionaryAsync(x => (x.POId, x.MaterialId), x => x.Total, cancellationToken);

        var poGrouped = activePoItems
            .GroupBy(p => p.MaterialId)
            .ToDictionary(
                g => g.Key,
                g => g.Sum(pi =>
                {
                    decimal poQtyNormalized = pi.Quantity * (pi.ConversionRate > 0 ? pi.ConversionRate : 1m);
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
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity * (x.ConversionRate > 0 ? x.ConversionRate : 1m)));

        var reportDto = new BoqVsActualReportDto { ProjectId = request.ProjectId };

        foreach (var boq in boqGrouped)
        {
            var issued = issuedGrouped.ContainsKey(boq.MaterialId) ? issuedGrouped[boq.MaterialId] : 0;
            var returned = returnedGrouped.ContainsKey(boq.MaterialId) ? returnedGrouped[boq.MaterialId] : 0;

            var item = new BoqVsActualItemDto
            {
                MaterialId = boq.MaterialId,
                MaterialCode = boq.MaterialCode,
                MaterialName = boq.MaterialName,
                UnitName = boq.UnitName,
                BoqLimit = boq.BoqLimit,
                TotalIssued = issued,
                TotalReturned = returned,
                StockRemaining = inventories.Where(i => i.MaterialId == boq.MaterialId).Sum(i => i.Quantity),
                PendingPoQuantity = poGrouped.ContainsKey(boq.MaterialId) ? poGrouped[boq.MaterialId] : 0,
                PendingMrQuantity = mrGrouped.ContainsKey(boq.MaterialId) ? mrGrouped[boq.MaterialId] : 0
            };
            reportDto.Items.Add(item);
        }

        return ApiResponse<BoqVsActualReportDto>.SuccessResult(reportDto);
    }
}

