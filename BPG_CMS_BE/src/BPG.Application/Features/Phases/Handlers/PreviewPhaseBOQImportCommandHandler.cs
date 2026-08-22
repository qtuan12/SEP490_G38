using BPG.Application.Common.Helpers;
using BPG.Application.DTOs.Phases;
using BPG.Application.Features.Phases.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Phases.Handlers;

public class PreviewPhaseBOQImportCommandHandler
    : IRequestHandler<PreviewPhaseBOQImportCommand, PhaseBOQImportPreviewDto>
{
    private readonly IUnitOfWork _uow;

    public PreviewPhaseBOQImportCommandHandler(IUnitOfWork uow) => _uow = uow;

    public async Task<PhaseBOQImportPreviewDto> Handle(
        PreviewPhaseBOQImportCommand request,
        CancellationToken cancellationToken)
    {
        await PhaseBOQModificationGuard.EnsureEditableAsync(
            _uow, request.ProjectId, request.PhaseId, cancellationToken);

        var existingItems = await _uow.Repository<BOQItem>().Query()
            .Include(x => x.Material)
            .Include(x => x.Unit)
            .Where(x => x.PhaseId == request.PhaseId && !x.IsDeleted)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var normalizedMaterialCodes = request.Rows
            .Select(x => NormalizeCode(x.MaterialCode))
            .Where(x => x.Length > 0)
            .Distinct()
            .ToList();

        var materials = await _uow.Repository<MaterialCatalog>().Query()
            .Where(x => normalizedMaterialCodes.Contains(x.Code.ToUpper()))
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var normalizedUnitCodes = request.Rows
            .Select(x => NormalizeCode(x.UnitCode))
            .Where(x => x.Length > 0)
            .Distinct()
            .ToList();
        var existingUnitIds = existingItems.Select(x => x.UnitId).Distinct().ToList();

        var units = await _uow.Repository<BPG.Domain.Entities.Unit>().Query()
            .Where(x => normalizedUnitCodes.Contains(x.UnitCode.ToUpper()) || existingUnitIds.Contains(x.UnitId))
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var materialIds = materials.Select(x => x.MaterialId).ToList();
        var unitIds = units.Select(x => x.UnitId).ToList();
        var conversions = await _uow.Repository<MaterialConversion>().Query()
            .Where(x => materialIds.Contains(x.MaterialId) && unitIds.Contains(x.AlternativeUnitId))
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var materialByCode = materials.ToDictionary(x => NormalizeCode(x.Code), StringComparer.OrdinalIgnoreCase);
        var unitByCode = units.ToDictionary(x => NormalizeCode(x.UnitCode), StringComparer.OrdinalIgnoreCase);
        var conversionByPair = conversions.ToDictionary(
            x => (x.MaterialId, x.AlternativeUnitId),
            x => x.ConversionRate);
        var existingByMaterialId = existingItems.ToDictionary(x => x.MaterialId);
        var inUseMaterialIds = await PhaseBOQModificationGuard.GetInUseMaterialIdsAsync(
            _uow, request.PhaseId, cancellationToken);

        var duplicateCodes = request.Rows
            .Select(x => NormalizeCode(x.MaterialCode))
            .Where(x => x.Length > 0)
            .GroupBy(x => x, StringComparer.OrdinalIgnoreCase)
            .Where(x => x.Count() > 1)
            .Select(x => x.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var result = new PhaseBOQImportPreviewDto();
        var resolvedItems = new Dictionary<long, PhaseBOQImportMergedItemDto>();

        foreach (var row in request.Rows.OrderBy(x => x.RowNumber))
        {
            var materialCode = NormalizeCode(row.MaterialCode);
            var unitCode = NormalizeCode(row.UnitCode);
            var rowResult = new PhaseBOQImportRowResultDto
            {
                RowNumber = row.RowNumber,
                MaterialCode = (row.MaterialCode ?? string.Empty).Trim(),
                Quantity = row.Quantity,
                UnitCode = (row.UnitCode ?? string.Empty).Trim()
            };

            if (row.RowNumber < 2)
                rowResult.Errors.Add("Số dòng Excel không hợp lệ.");
            if (materialCode.Length == 0)
                rowResult.Errors.Add("Mã vật tư không được để trống.");
            if (unitCode.Length == 0)
                rowResult.Errors.Add("Mã đơn vị tính không được để trống.");
            if (row.Quantity <= 0)
                rowResult.Errors.Add("Số lượng định mức phải lớn hơn 0.");
            if (decimal.Round(row.Quantity, 3) != row.Quantity)
                rowResult.Errors.Add("Số lượng chỉ được có tối đa 3 chữ số thập phân.");
            if (duplicateCodes.Contains(materialCode))
                rowResult.Errors.Add("Mã vật tư bị trùng trong file Excel.");

            materialByCode.TryGetValue(materialCode, out var material);
            unitByCode.TryGetValue(unitCode, out var unit);

            if (material == null && materialCode.Length > 0)
                rowResult.Errors.Add($"Không tìm thấy vật tư có mã '{(row.MaterialCode ?? string.Empty).Trim()}'.");
            if (unit == null && unitCode.Length > 0)
                rowResult.Errors.Add($"Không tìm thấy đơn vị tính có mã '{(row.UnitCode ?? string.Empty).Trim()}'.");

            if (material != null)
            {
                rowResult.MaterialCode = material.Code;
                rowResult.MaterialName = material.Name;
            }

            if (unit != null)
            {
                rowResult.UnitCode = unit.UnitCode;
                rowResult.UnitName = unit.UnitName;
            }

            if (material != null && unit != null)
            {
                decimal? selectedConversionRate = null;
                if (material.BaseUnitId == unit.UnitId)
                    selectedConversionRate = 1m;
                else if (conversionByPair.TryGetValue((material.MaterialId, unit.UnitId), out var alternativeRate))
                    selectedConversionRate = alternativeRate;
                if (selectedConversionRate == null)
                    rowResult.Errors.Add($"Đơn vị '{unit.UnitName}' không được hỗ trợ cho vật tư '{material.Name}'.");

                if (unit.IsDiscrete && row.Quantity % 1 != 0)
                    rowResult.Errors.Add($"Đơn vị '{unit.UnitName}' yêu cầu số lượng phải là số nguyên.");

                if (existingByMaterialId.TryGetValue(material.MaterialId, out var current)
                    && inUseMaterialIds.Contains(material.MaterialId)
                    && selectedConversionRate != null
                    && (current.Quantity != row.Quantity
                        || current.UnitId != unit.UnitId
                        || current.ConversionRate != selectedConversionRate.Value))
                {
                    rowResult.Errors.Add($"Không thể thay đổi định mức vật tư '{material.Name}' vì đã phát sinh nghiệp vụ sử dụng.");
                }
            }

            if (rowResult.Errors.Count > 0)
            {
                rowResult.Status = BOQImportRowStatus.Error;
                result.Rows.Add(rowResult);
                continue;
            }

            var existing = existingByMaterialId.GetValueOrDefault(material!.MaterialId);
            var conversionRate = material.BaseUnitId == unit!.UnitId
                ? 1m
                : conversionByPair[(material.MaterialId, unit.UnitId)];
            rowResult.Status = existing == null
                ? BOQImportRowStatus.New
                : existing.Quantity == row.Quantity
                    && existing.UnitId == unit.UnitId
                    && existing.ConversionRate == conversionRate
                    ? BOQImportRowStatus.Unchanged
                    : BOQImportRowStatus.Updated;

            resolvedItems[material.MaterialId] = new PhaseBOQImportMergedItemDto
            {
                MaterialId = material.MaterialId,
                MaterialCode = material.Code,
                MaterialName = material.Name,
                Quantity = row.Quantity,
                UnitId = unit!.UnitId,
                UnitCode = unit.UnitCode,
                UnitName = unit.UnitName
            };
            result.Rows.Add(rowResult);
        }

        var requestedMaterialCodes = request.Rows
            .Select(x => NormalizeCode(x.MaterialCode))
            .Where(x => x.Length > 0)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var existing in existingItems
            .Where(x => !requestedMaterialCodes.Contains(NormalizeCode(x.Material.Code)))
            .OrderBy(x => x.Material.Code))
        {
            var rowResult = new PhaseBOQImportRowResultDto
            {
                RowNumber = 0,
                MaterialCode = existing.Material.Code,
                MaterialName = existing.Material.Name,
                Quantity = existing.Quantity,
                UnitCode = existing.Unit.UnitCode,
                UnitName = existing.Unit.UnitName,
                Status = BOQImportRowStatus.Deleted
            };

            if (inUseMaterialIds.Contains(existing.MaterialId))
            {
                rowResult.Status = BOQImportRowStatus.Error;
                rowResult.Errors.Add($"Không thể xóa vật tư '{existing.Material.Name}' khỏi định mức vì đã phát sinh nghiệp vụ sử dụng.");
            }

            result.Rows.Add(rowResult);
        }

        result.NewCount = result.Rows.Count(x => x.Status == BOQImportRowStatus.New);
        result.UpdatedCount = result.Rows.Count(x => x.Status == BOQImportRowStatus.Updated);
        result.UnchangedCount = result.Rows.Count(x => x.Status == BOQImportRowStatus.Unchanged);
        result.DeletedCount = result.Rows.Count(x => x.Status == BOQImportRowStatus.Deleted);
        result.ErrorCount = result.Rows.Count(x => x.Status == BOQImportRowStatus.Error);
        result.CanApply = result.ErrorCount == 0 && result.Rows.Count > 0;

        if (result.CanApply)
        {
            result.MergedItems = resolvedItems.Values
                .OrderBy(x => x.MaterialCode)
                .ToList();
        }

        return result;
    }

    private static string NormalizeCode(string? value) =>
        (value ?? string.Empty).Trim().ToUpperInvariant();
}
