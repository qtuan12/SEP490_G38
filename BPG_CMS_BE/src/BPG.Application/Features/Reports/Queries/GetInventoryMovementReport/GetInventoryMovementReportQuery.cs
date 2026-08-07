using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Reports.Queries.GetInventoryMovementReport;

public record GetInventoryMovementReportQuery(long ProjectId, DateTime? FromDate = null, DateTime? ToDate = null)
    : IRequest<ApiResponse<InventoryMovementReportDto>>;

public class GetInventoryMovementReportQueryHandler
    : IRequestHandler<GetInventoryMovementReportQuery, ApiResponse<InventoryMovementReportDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IProjectAccessService _projectAccessService;

    public GetInventoryMovementReportQueryHandler(
        IUnitOfWork unitOfWork,
        IProjectAccessService projectAccessService)
    {
        _unitOfWork = unitOfWork;
        _projectAccessService = projectAccessService;
    }

    public async Task<ApiResponse<InventoryMovementReportDto>> Handle(
        GetInventoryMovementReportQuery request, CancellationToken cancellationToken)
    {
        var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
        if (request.ProjectId > 0 && !accessibleProjectIds.Contains(request.ProjectId))
        {
            throw new BusinessException("ERR_FORBIDDEN", "Bạn không có quyền truy cập báo cáo của dự án này.");
        }

        var targetProjectId = request.ProjectId;

        // Query transactions up to ToDate
        var query = _unitOfWork.Repository<InventoryTransaction>()
            .Query()
            .Include(t => t.Material)
                .ThenInclude(m => m.BaseUnit)
            .AsNoTracking();

        if (targetProjectId > 0)
        {
            query = query.Where(t => t.ProjectId == targetProjectId);
        }
        else
        {
            query = query.Where(t => accessibleProjectIds.Contains(t.ProjectId));
        }

        var allTransactions = await query.ToListAsync(cancellationToken);

        var fromDate = request.FromDate?.Date;
        var toDate = request.ToDate?.Date.AddDays(1).AddTicks(-1);

        var materials = allTransactions
            .Select(t => t.Material)
            .Where(m => m != null)
            .DistinctBy(m => m.MaterialId)
            .ToList();

        // Also fetch current inventory items
        var inventoryQuery = _unitOfWork.Repository<CurrentInventory>()
            .Query()
            .Include(i => i.Material)
                .ThenInclude(m => m.BaseUnit)
            .AsNoTracking();

        if (targetProjectId > 0)
        {
            inventoryQuery = inventoryQuery.Where(i => i.ProjectId == targetProjectId);
        }
        else
        {
            inventoryQuery = inventoryQuery.Where(i => accessibleProjectIds.Contains(i.ProjectId));
        }

        var currentInventories = await inventoryQuery.ToListAsync(cancellationToken);

        foreach (var inv in currentInventories)
        {
            if (inv.Material != null && !materials.Any(m => m.MaterialId == inv.MaterialId))
            {
                materials.Add(inv.Material);
            }
        }

        var items = new List<InventoryMovementItemDto>();

        foreach (var mat in materials)
        {
            var matTrans = allTransactions.Where(t => t.MaterialId == mat.MaterialId).ToList();

            decimal openingBalance = 0m;
            if (fromDate.HasValue)
            {
                openingBalance = matTrans
                    .Where(t => t.CreatedAt < fromDate.Value)
                    .Sum(t => t.QuantityChange);
            }

            var periodTrans = matTrans.AsEnumerable();
            if (fromDate.HasValue)
            {
                periodTrans = periodTrans.Where(t => t.CreatedAt >= fromDate.Value);
            }
            if (toDate.HasValue)
            {
                periodTrans = periodTrans.Where(t => t.CreatedAt <= toDate.Value);
            }
            var periodList = periodTrans.ToList();

            // Categorize transactions
            // Receipt = positive change with ReferenceType GoodsReceipt
            decimal received = periodList
                .Where(t => t.ReferenceType == EntityType.GoodsReceipt && t.QuantityChange > 0)
                .Sum(t => t.QuantityChange);

            // Issuance = negative change with ReferenceType MaterialIssuance
            decimal issued = Math.Abs(periodList
                .Where(t => t.ReferenceType == EntityType.MaterialIssuance && t.QuantityChange < 0)
                .Sum(t => t.QuantityChange));

            // Return = positive change with ReferenceType MaterialReturn
            decimal returned = periodList
                .Where(t => t.ReferenceType == EntityType.MaterialReturn && t.QuantityChange > 0)
                .Sum(t => t.QuantityChange);

            // Transfers in/out
            decimal transIn = periodList
                .Where(t => t.ReferenceType == EntityType.SurplusTransferReceive && t.QuantityChange > 0)
                .Sum(t => t.QuantityChange);

            decimal transOut = Math.Abs(periodList
                .Where(t => t.ReferenceType == EntityType.SurplusTransferDispatch && t.QuantityChange < 0)
                .Sum(t => t.QuantityChange));

            // Adjustments
            decimal adjustments = periodList
                .Where(t => t.ReferenceType == EntityType.InventoryAdjustment)
                .Sum(t => t.QuantityChange);

            // Other changes
            decimal others = periodList
                .Where(t => t.ReferenceType != EntityType.GoodsReceipt &&
                            t.ReferenceType != EntityType.MaterialIssuance &&
                            t.ReferenceType != EntityType.MaterialReturn &&
                            t.ReferenceType != EntityType.SurplusTransferReceive &&
                            t.ReferenceType != EntityType.SurplusTransferDispatch &&
                            t.ReferenceType != EntityType.InventoryAdjustment)
                .Sum(t => t.QuantityChange);

            decimal netPeriodChange = received + returned + transIn + adjustments + others - issued - transOut;
            decimal closingBalance = openingBalance + netPeriodChange;

            // If no date filter is applied, fallback closing balance to actual CurrentInventory sum
            if (!fromDate.HasValue && !toDate.HasValue)
            {
                closingBalance = currentInventories
                    .Where(i => i.MaterialId == mat.MaterialId)
                    .Sum(i => i.Quantity);
            }

            items.Add(new InventoryMovementItemDto
            {
                MaterialId = mat.MaterialId,
                MaterialCode = mat.Code,
                MaterialName = mat.Name,
                UnitName = mat.BaseUnit?.UnitName ?? string.Empty,
                OpeningBalance = openingBalance,
                TotalReceived = received,
                TotalIssued = issued,
                TotalReturned = returned,
                TotalTransferredIn = transIn,
                TotalTransferredOut = transOut,
                TotalAdjustments = adjustments + others,
                ClosingBalance = closingBalance
            });
        }

        var resultDto = new InventoryMovementReportDto
        {
            ProjectId = targetProjectId,
            FromDate = request.FromDate,
            ToDate = request.ToDate,
            TotalMaterials = items.Count,
            Items = items
        };

        return ApiResponse<InventoryMovementReportDto>.SuccessResult(resultDto);
    }
}
