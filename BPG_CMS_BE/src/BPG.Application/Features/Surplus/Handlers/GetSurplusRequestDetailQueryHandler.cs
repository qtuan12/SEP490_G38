using BPG.Application.Common.Models;
using BPG.Application.DTOs.Surplus;
using BPG.Application.Features.Surplus.Queries;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Surplus.Handlers;

public class GetSurplusRequestDetailQueryHandler : IRequestHandler<GetSurplusRequestDetailQuery, ApiResponse<SurplusRequestDetailDto>>
{
    private readonly IUnitOfWork _uow;
    private readonly ISurplusMaterialSupplierService _supplierService;

    public GetSurplusRequestDetailQueryHandler(
        IUnitOfWork uow,
        ISurplusMaterialSupplierService supplierService)
    {
        _uow = uow;
        _supplierService = supplierService;
    }

    public async Task<ApiResponse<SurplusRequestDetailDto>> Handle(GetSurplusRequestDetailQuery request, CancellationToken ct)
    {
        var sr = await _uow.Repository<SurplusRequest>().Query()
            .Include(x => x.Project)
            .Include(x => x.Items)
                .ThenInclude(i => i.Material)
            .Include(x => x.Items)
                .ThenInclude(i => i.Unit)
            .Include(x => x.Items)
                .ThenInclude(i => i.ReturnToSuppliers)
            .Include(x => x.Items)
                .ThenInclude(i => i.Transfers)
            .Include(x => x.Items)
                .ThenInclude(i => i.Liquidations)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.SurplusRequestId == request.SurplusRequestId, ct)
            ?? throw new NotFoundException(nameof(SurplusRequest), request.SurplusRequestId);

        // Fetch creator name
        string createdByName = "N/A";
        if (sr.CreatedBy.HasValue)
        {
            var creator = await _uow.Repository<User>().GetByIdAsync(sr.CreatedBy.Value, ct);
            createdByName = creator?.FullName ?? "N/A";
        }

        var suppliersByMaterial = await _supplierService.GetLatestApprovedSuppliersAsync(
            sr.ProjectId,
            sr.Items.Select(item => item.MaterialId).Distinct().ToArray(),
            ct);
        var materialIds = sr.Items.Select(i => i.MaterialId).Distinct().ToList();
        var inventoryByMaterial = await _uow.Repository<CurrentInventory>().Query()
            .Where(ci => ci.ProjectId == sr.ProjectId && materialIds.Contains(ci.MaterialId))
            .AsNoTracking()
            .ToDictionaryAsync(ci => ci.MaterialId, ct);

        var dto = new SurplusRequestDetailDto
        {
            SurplusRequestId = sr.SurplusRequestId,
            ProjectId = sr.ProjectId,
            ProjectName = sr.Project.Name,
            Reason = sr.Reason,
            Status = sr.Status,
            CreatedAt = sr.CreatedAt,
            CreatedByName = createdByName,
            TotalItems = sr.Items.Count,
            ProcessedItems = sr.Items.Count(i => i.Status == Domain.Constants.SurplusRequestItemStatus.Completed),
            Items = sr.Items.Select(i =>
            {
                suppliersByMaterial.TryGetValue(i.MaterialId, out var supplier);
                inventoryByMaterial.TryGetValue(i.MaterialId, out var inventory);
                return new SurplusRequestItemDto
                {
                SurplusRequestItemId = i.SurplusRequestItemId,
                SurplusRequestId = i.SurplusRequestId,
                MaterialId = i.MaterialId,
                MaterialCode = i.Material.Code,
                MaterialName = i.Material.Name,
                UnitId = i.UnitId,
                UnitName = i.Unit.UnitName,
                SupplierId = supplier?.SupplierId,
                SupplierName = supplier?.SupplierName,
                Quantity = i.Quantity,
                ProcessedQuantity = i.ProcessedQuantity,
                CurrentInventoryQuantity = inventory?.Quantity ?? 0,
                ReservedQuantity = inventory?.ReservedQuantity ?? 0,
                CloseReason = i.CloseReason,
                Status = i.Status,
                Actions = BuildActionSummaries(i)
                };
            }).ToList()
        };

        return ApiResponse<SurplusRequestDetailDto>.SuccessResult(dto);
    }

    private static List<SurplusActionSummaryDto> BuildActionSummaries(SurplusRequestItem i)
    {
        var list = new List<SurplusActionSummaryDto>();
        list.AddRange(i.ReturnToSuppliers.Select(r => new SurplusActionSummaryDto
        {
            ActionType = Domain.Constants.SurplusActionType.ReturnSupplier,
            ActionId = r.SurplusReturnSupplierId,
            Status = "Completed",
            Quantity = r.ReturnQuantity
        }));
        list.AddRange(i.Transfers.Select(t => new SurplusActionSummaryDto
        {
            ActionType = Domain.Constants.SurplusActionType.Transfer,
            ActionId = t.SurplusTransferId,
            Status = t.Status,
            Quantity = t.TransferQuantity
        }));
        list.AddRange(i.Liquidations.Select(l => new SurplusActionSummaryDto
        {
            ActionType = Domain.Constants.SurplusActionType.Liquidate,
            ActionId = l.SurplusLiquidationId,
            Status = "Completed",
            Quantity = l.LiquidationQuantity
        }));
        return list;
    }
}
