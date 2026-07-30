using BPG.Application.IRepositories;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Reports.Queries.GetInventoryLedgerReport;

public record GetInventoryLedgerReportQuery(long ProjectId)
    : IRequest<ApiResponse<InventoryLedgerReportDto>>
{
}

public class GetInventoryLedgerReportQueryHandler
    : IRequestHandler<GetInventoryLedgerReportQuery, ApiResponse<InventoryLedgerReportDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetInventoryLedgerReportQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse<InventoryLedgerReportDto>> Handle(
        GetInventoryLedgerReportQuery request, CancellationToken cancellationToken)
    {
        var currentInventory = await _unitOfWork.Repository<CurrentInventory>()
            .Query()
            .Include(i => i.Material)
                .ThenInclude(m => m.BaseUnit)
            .Where(i => i.ProjectId == request.ProjectId)
            .OrderBy(i => i.Material.Name)
            .ToListAsync(cancellationToken);

        var transactions = await _unitOfWork.Repository<InventoryTransaction>()
            .Query()
            .Include(t => t.Material)
                .ThenInclude(m => m.BaseUnit)
            .Where(t => t.ProjectId == request.ProjectId)
            .OrderByDescending(t => t.CreatedAt)
            .Take(500)
            .ToListAsync(cancellationToken);

        // Resolve creator names
        var creatorIds = transactions
            .Where(t => t.CreatedBy.HasValue)
            .Select(t => t.CreatedBy!.Value)
            .Distinct()
            .ToList();

        var creators = await _unitOfWork.Repository<User>()
            .Query()
            .Where(u => creatorIds.Contains(u.UserId))
            .ToDictionaryAsync(u => u.UserId, u => u.FullName, cancellationToken);

        var currentStockList = currentInventory.Select(i => new CurrentInventorySummaryDto
        {
            MaterialId = i.MaterialId,
            MaterialCode = i.Material?.Code ?? string.Empty,
            MaterialName = i.Material?.Name ?? string.Empty,
            UnitName = i.Material?.BaseUnit?.UnitName ?? string.Empty,
            CurrentQuantity = i.Quantity
        }).ToList();

        var transactionList = transactions.Select(t => new InventoryTransactionSummaryDto
        {
            TransactionId = t.TransactionId,
            MaterialId = t.MaterialId,
            MaterialCode = t.Material?.Code ?? string.Empty,
            MaterialName = t.Material?.Name ?? string.Empty,
            UnitName = t.Material?.BaseUnit?.UnitName ?? string.Empty,
            ReferenceType = t.ReferenceType ?? string.Empty,
            QuantityChange = t.QuantityChange,
            BalanceAfter = t.BalanceAfter,
            CreatedByName = t.CreatedBy.HasValue && creators.ContainsKey(t.CreatedBy.Value)
                ? creators[t.CreatedBy.Value]
                : null,
            CreatedAt = t.CreatedAt
        }).ToList();

        var dto = new InventoryLedgerReportDto
        {
            ProjectId = request.ProjectId,
            TotalMaterialTypes = currentInventory.Count,
            ZeroStockCount = currentInventory.Count(i => i.Quantity <= 0),
            CurrentStock = currentStockList,
            Transactions = transactionList
        };

        return ApiResponse<InventoryLedgerReportDto>.SuccessResult(dto);
    }
}

