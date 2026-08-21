using BPG.Application.DTOs.MaterialRequests;
using BPG.Application.Features.MaterialRequests.Queries;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RoleConstants = BPG.Domain.Constants.UserRole;

namespace BPG.Application.Features.MaterialRequests.Handlers;

public sealed class GetMaterialRequestAssessmentQueryHandler
    : IRequestHandler<GetMaterialRequestAssessmentQuery, MaterialRequestAssessmentDto>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly IProjectAccessService _projectAccess;

    public GetMaterialRequestAssessmentQueryHandler(
        IUnitOfWork uow,
        ICurrentUserService currentUser,
        IProjectAccessService projectAccess)
    {
        _uow = uow;
        _currentUser = currentUser;
        _projectAccess = projectAccess;
    }

    public async Task<MaterialRequestAssessmentDto> Handle(
        GetMaterialRequestAssessmentQuery request,
        CancellationToken ct)
    {
        if (!_currentUser.IsInAnyRole(RoleConstants.Accountant, RoleConstants.TechnicalManager, RoleConstants.Director))
            throw new ForbiddenException("Bạn không có quyền xem cơ sở thẩm định yêu cầu vật tư.");

        var materialRequest = await _uow.Repository<MaterialRequest>().Query()
            .AsNoTracking()
            .Include(entity => entity.Phase)
            .Include(entity => entity.Items)
                .ThenInclude(item => item.Unit)
            .FirstOrDefaultAsync(entity => entity.RequestId == request.RequestId, ct)
            ?? throw new NotFoundException(nameof(MaterialRequest), request.RequestId);

        var accessibleProjectIds = await _projectAccess.GetAccessibleProjectIdsAsync(ct);
        var projectId = materialRequest.Phase.ProjectId;
        if (!accessibleProjectIds.Contains(projectId))
            throw new ForbiddenException("Bạn không có quyền xem cơ sở thẩm định của dự án này.");

        var items = materialRequest.Items.ToList();
        var materialIds = items.Select(item => item.MaterialId).Distinct().ToList();
        var accessibleIds = accessibleProjectIds.ToList();

        var projectInventory = await _uow.Repository<CurrentInventory>().Query()
            .AsNoTracking()
            .Where(inventory => inventory.ProjectId == projectId && materialIds.Contains(inventory.MaterialId))
            .ToDictionaryAsync(inventory => inventory.MaterialId, ct);

        var activePOItems = await _uow.Repository<PurchaseOrderItem>().Query()
            .AsNoTracking()
            .Include(item => item.PurchaseOrder)
            .Where(item => item.PurchaseOrder.ProjectId == projectId
                && materialIds.Contains(item.MaterialId)
                && (item.PurchaseOrder.Status == PurchaseOrderStatus.Sent
                    || item.PurchaseOrder.Status == PurchaseOrderStatus.PartiallyReceived))
            .ToListAsync(ct);

        var activePOIds = activePOItems.Select(item => item.POId).Distinct().ToList();
        var approvedReceiptItems = activePOIds.Count == 0
            ? new List<GoodsReceiptItem>()
            : await _uow.Repository<GoodsReceiptItem>().Query()
                .AsNoTracking()
                .Include(item => item.Receipt)
                .Where(item => activePOIds.Contains(item.Receipt.POId)
                    && materialIds.Contains(item.MaterialId)
                    && item.Receipt.Status == GoodsReceiptStatus.Approved)
                .ToListAsync(ct);

        var receivedByPOAndMaterial = approvedReceiptItems
            .GroupBy(item => (item.Receipt.POId, item.MaterialId))
            .ToDictionary(
                group => group.Key,
                group => group.Sum(item => ToBase(item.Quantity, item.ConversionRate)));

        var surplusItems = await _uow.Repository<SurplusRequestItem>().Query()
            .AsNoTracking()
            .Include(item => item.SurplusRequest)
                .ThenInclude(surplus => surplus.Project)
            .Where(item => materialIds.Contains(item.MaterialId)
                && item.SurplusRequest.ProjectId != projectId
                && accessibleIds.Contains(item.SurplusRequest.ProjectId)
                && item.SurplusRequest.Project.Status == ProjectStatus.InProgress
                && item.SurplusRequest.Status == SurplusRequestStatus.Processing
                && (item.Status == SurplusRequestItemStatus.Pending
                    || item.Status == SurplusRequestItemStatus.Processing))
            .ToListAsync(ct);

        var sourceProjectIds = surplusItems
            .Select(item => item.SurplusRequest.ProjectId)
            .Distinct()
            .ToList();
        var sourceInventory = sourceProjectIds.Count == 0
            ? new List<CurrentInventory>()
            : await _uow.Repository<CurrentInventory>().Query()
                .AsNoTracking()
                .Where(inventory => sourceProjectIds.Contains(inventory.ProjectId)
                    && materialIds.Contains(inventory.MaterialId))
                .ToListAsync(ct);
        var sourceInventoryByProjectAndMaterial = sourceInventory
            .GroupBy(inventory => (inventory.ProjectId, inventory.MaterialId))
            .ToDictionary(
                group => group.Key,
                group => group.Sum(inventory => Math.Max(0, inventory.Quantity - inventory.ReservedQuantity)));

        var priceItems = await _uow.Repository<PurchaseOrderItem>().Query()
            .AsNoTracking()
            .Include(item => item.PurchaseOrder)
            .Where(item => materialIds.Contains(item.MaterialId)
                && accessibleIds.Contains(item.PurchaseOrder.ProjectId)
                && item.UnitPrice > 0
                && (item.PurchaseOrder.Status == PurchaseOrderStatus.Sent
                    || item.PurchaseOrder.Status == PurchaseOrderStatus.PartiallyReceived
                    || item.PurchaseOrder.Status == PurchaseOrderStatus.FullyReceived
                    || item.PurchaseOrder.Status == PurchaseOrderStatus.Closed))
            .OrderByDescending(item => item.PurchaseOrder.OrderDate)
            .ThenByDescending(item => item.POId)
            .ThenByDescending(item => item.POItemId)
            .ToListAsync(ct);

        return new MaterialRequestAssessmentDto
        {
            RequestId = materialRequest.RequestId,
            ProjectId = projectId,
            Items = items.Select(item => BuildItem(
                item,
                projectInventory,
                activePOItems,
                receivedByPOAndMaterial,
                surplusItems,
                sourceInventoryByProjectAndMaterial,
                priceItems)).ToList()
        };
    }

    private static MaterialRequestAssessmentItemDto BuildItem(
        MaterialRequestItem item,
        IReadOnlyDictionary<long, CurrentInventory> projectInventory,
        IReadOnlyCollection<PurchaseOrderItem> activePOItems,
        IReadOnlyDictionary<(long POId, long MaterialId), decimal> receivedByPOAndMaterial,
        IReadOnlyCollection<SurplusRequestItem> surplusItems,
        IReadOnlyDictionary<(long ProjectId, long MaterialId), decimal> sourceInventory,
        IReadOnlyCollection<PurchaseOrderItem> priceItems)
    {
        var requestRate = SafeRate(item.ConversionRate);
        projectInventory.TryGetValue(item.MaterialId, out var inventory);

        var activeSupplies = activePOItems
            .Where(poItem => poItem.MaterialId == item.MaterialId)
            .GroupBy(poItem => poItem.POId)
            .Select(group =>
            {
                var po = group.First().PurchaseOrder;
                var orderedBase = group.Sum(poItem => ToBase(poItem.Quantity, poItem.ConversionRate));
                receivedByPOAndMaterial.TryGetValue((group.Key, item.MaterialId), out var receivedBase);
                var remaining = Math.Max(0, orderedBase - receivedBase) * requestRate;
                return new MaterialRequestActiveSupplyDto
                {
                    POId = group.Key,
                    PONumber = po.PONumber,
                    RemainingQuantity = remaining
                };
            })
            .Where(supply => supply.RemainingQuantity > 0)
            .OrderBy(supply => supply.PONumber)
            .ToList();

        var internalSources = surplusItems
            .Where(source => source.MaterialId == item.MaterialId)
            .GroupBy(source => new
            {
                source.SurplusRequest.ProjectId,
                source.SurplusRequest.Project.Name
            })
            .Select(group =>
            {
                var surplusBase = group.Sum(source => Math.Max(
                    0,
                    ToBase(source.Quantity - source.ProcessedQuantity, source.ConversionRate)));
                sourceInventory.TryGetValue((group.Key.ProjectId, item.MaterialId), out var inventoryBase);
                return new MaterialRequestInternalSourceDto
                {
                    ProjectId = group.Key.ProjectId,
                    ProjectName = group.Key.Name,
                    AvailableQuantity = Math.Min(surplusBase, inventoryBase) * requestRate
                };
            })
            .Where(source => source.AvailableQuantity > 0)
            .OrderByDescending(source => source.AvailableQuantity)
            .ThenBy(source => source.ProjectName)
            .ToList();

        var lastPriceItem = priceItems.FirstOrDefault(poItem => poItem.MaterialId == item.MaterialId);
        var lastPrice = lastPriceItem == null
            ? null
            : new MaterialRequestLastPurchasePriceDto
            {
                POId = lastPriceItem.POId,
                PONumber = lastPriceItem.PurchaseOrder.PONumber,
                UnitPrice = lastPriceItem.UnitPrice * SafeRate(lastPriceItem.ConversionRate) / requestRate,
                OrderDate = DateOnly.FromDateTime(lastPriceItem.PurchaseOrder.OrderDate)
            };

        return new MaterialRequestAssessmentItemDto
        {
            RequestItemId = item.RequestItemId,
            MaterialId = item.MaterialId,
            UnitId = item.UnitId,
            UnitName = item.Unit.UnitName,
            ProjectInventoryQuantity = Math.Max(0, inventory?.Quantity ?? 0) * requestRate,
            ActiveSupplies = activeSupplies,
            InternalSources = internalSources,
            LastPurchasePrice = lastPrice
        };
    }

    private static decimal ToBase(decimal quantity, decimal conversionRate) =>
        quantity / SafeRate(conversionRate);

    private static decimal SafeRate(decimal conversionRate) =>
        conversionRate > 0 ? conversionRate : 1m;
}
