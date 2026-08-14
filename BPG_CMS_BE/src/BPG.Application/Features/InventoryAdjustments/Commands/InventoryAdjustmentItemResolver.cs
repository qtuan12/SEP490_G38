using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.InventoryAdjustments.Commands;

internal sealed record ResolvedAdjustmentItem(
    AdjustmentItemRequest Request,
    MaterialCatalog Material,
    Unit Unit,
    int UnitId,
    decimal ConversionRate)
{
    // The shared inventory balance is always stored in the material base unit.
    public decimal BaseQuantity => InventoryAdjustmentQuantity.ToBase(
        Request.Quantity,
        ConversionRate);
}

internal static class InventoryAdjustmentQuantity
{
    private const int StorageScale = 3;

    public static decimal ToBase(decimal quantity, decimal conversionRate)
    {
        var effectiveRate = conversionRate > 0 ? conversionRate : 1m;
        return decimal.Round(
            quantity / effectiveRate,
            StorageScale,
            MidpointRounding.AwayFromZero);
    }

    public static decimal ToBase(AdjustmentItem item)
        => ToBase(item.Quantity, item.ConversionRate);
}

internal static class InventoryAdjustmentItemResolver
{
    public static async Task<IReadOnlyList<ResolvedAdjustmentItem>> ResolveAsync(
        IUnitOfWork unitOfWork,
        IReadOnlyCollection<AdjustmentItemRequest> requests,
        CancellationToken cancellationToken)
    {
        var materialIds = requests.Select(item => item.MaterialId).Distinct().ToArray();
        var materials = await unitOfWork.Repository<MaterialCatalog>()
            .Query()
            .Include(material => material.BaseUnit)
            .Where(material => materialIds.Contains(material.MaterialId))
            .ToListAsync(cancellationToken);
        var materialMap = materials.ToDictionary(material => material.MaterialId);

        var alternativeUnitIds = requests
            .Where(item => materialMap.TryGetValue(item.MaterialId, out var material)
                && ResolveRequestedUnitId(item, material) != material.BaseUnitId)
            .Select(item => ResolveRequestedUnitId(item, materialMap[item.MaterialId]))
            .Distinct()
            .ToArray();

        var conversionMap = alternativeUnitIds.Length == 0
            ? new Dictionary<(long MaterialId, int UnitId), MaterialConversion>()
            : await unitOfWork.Repository<MaterialConversion>()
                .Query()
                .AsNoTracking()
                .Include(conversion => conversion.AlternativeUnit)
                .Where(conversion => materialIds.Contains(conversion.MaterialId)
                    && alternativeUnitIds.Contains(conversion.AlternativeUnitId))
                .ToDictionaryAsync(
                    conversion => (conversion.MaterialId, conversion.AlternativeUnitId),
                    cancellationToken);

        var resolvedItems = new List<ResolvedAdjustmentItem>(requests.Count);
        foreach (var request in requests)
        {
            if (!materialMap.TryGetValue(request.MaterialId, out var material))
            {
                throw new NotFoundException(nameof(MaterialCatalog), request.MaterialId);
            }

            Unit selectedUnit;
            decimal conversionRate;
            var selectedUnitId = ResolveRequestedUnitId(request, material);
            if (selectedUnitId == material.BaseUnitId)
            {
                selectedUnit = material.BaseUnit
                    ?? throw new BusinessException(
                        "ERR_INVALID_UNIT",
                        $"Vật tư [{material.Name}] chưa cấu hình đơn vị cơ bản.");
                conversionRate = 1m;
            }
            else if (conversionMap.TryGetValue((request.MaterialId, selectedUnitId), out var conversion)
                && conversion.ConversionRate > 0)
            {
                selectedUnit = conversion.AlternativeUnit;
                conversionRate = conversion.ConversionRate;
            }
            else
            {
                throw new BusinessException(
                    "ERR_INVALID_UNIT",
                    $"Đơn vị ID {selectedUnitId} không hợp lệ cho vật tư [{material.Name}].");
            }

            if (selectedUnit.IsDiscrete && request.Quantity % 1 != 0)
            {
                throw new BusinessException(
                    ErrorCodes.InvalidUnitQuantity,
                    $"Đơn vị tính '{selectedUnit.UnitName}' của vật tư [{material.Name}] yêu cầu số lượng phải là số nguyên.");
            }

            var exactBaseQuantity = request.Quantity / conversionRate;
            if (material.BaseUnit?.IsDiscrete == true && exactBaseQuantity % 1 != 0)
            {
                throw new BusinessException(
                    ErrorCodes.InvalidUnitQuantity,
                    $"Số lượng quy đổi sang đơn vị cơ bản '{material.BaseUnit.UnitName}' của vật tư [{material.Name}] phải là số nguyên.");
            }

            if (InventoryAdjustmentQuantity.ToBase(request.Quantity, conversionRate) <= 0)
            {
                throw new BusinessException(
                    "ERR_INVALID_QUANTITY",
                    $"Số lượng quy đổi của vật tư [{material.Name}] quá nhỏ để ghi nhận trong kho.");
            }

            resolvedItems.Add(new ResolvedAdjustmentItem(
                request,
                material,
                selectedUnit,
                selectedUnitId,
                conversionRate));
        }

        return resolvedItems;
    }

    private static int ResolveRequestedUnitId(
        AdjustmentItemRequest request,
        MaterialCatalog material)
        => request.UnitId.GetValueOrDefault() > 0
            ? request.UnitId.GetValueOrDefault()
            : material.BaseUnitId;
}
