using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Helpers;
using BPG.Application.Features.Phases.Commands;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System;

namespace BPG.Application.Features.Phases.Handlers;

public class UpdatePhaseBOQCommandHandler : IRequestHandler<UpdatePhaseBOQCommand, bool>
{
    private readonly IUnitOfWork _uow;
    private readonly ILogger<UpdatePhaseBOQCommandHandler> _logger;
    private readonly INotificationService _notificationService;
    private readonly ICurrentUserService _currentUserService;

    public UpdatePhaseBOQCommandHandler(
        IUnitOfWork uow, 
        ILogger<UpdatePhaseBOQCommandHandler> logger,
        INotificationService notificationService,
        ICurrentUserService currentUserService)
    {
        _uow = uow;
        _logger = logger;
        _notificationService = notificationService;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(UpdatePhaseBOQCommand request, CancellationToken cancellationToken)
    {
        await PhaseBOQModificationGuard.EnsureEditableAsync(
            _uow, request.ProjectId, request.PhaseId, cancellationToken);

        var existingAll = await _uow.Repository<BOQItem>().Query()
            .IgnoreQueryFilters()
            .Where(b => b.PhaseId == request.PhaseId)
            .ToListAsync(cancellationToken);

        var existingActive = existingAll.Where(b => !b.IsDeleted).ToList();
        var requestedMaterialIds = request.Items.Select(x => x.MaterialId).Distinct().ToList();
        var allMaterialIds = requestedMaterialIds
            .Concat(existingActive.Select(x => x.MaterialId))
            .Distinct()
            .ToList();
        var requestedUnitIds = request.Items.Select(x => x.UnitId).Distinct().ToList();

        var materials = await _uow.Repository<MaterialCatalog>().Query()
            .Where(x => allMaterialIds.Contains(x.MaterialId))
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        var materialById = materials.ToDictionary(x => x.MaterialId);

        var units = await _uow.Repository<BPG.Domain.Entities.Unit>().Query()
            .Where(x => requestedUnitIds.Contains(x.UnitId))
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        var unitById = units.ToDictionary(x => x.UnitId);

        var conversions = await _uow.Repository<MaterialConversion>().Query()
            .Where(x => requestedMaterialIds.Contains(x.MaterialId)
                && requestedUnitIds.Contains(x.AlternativeUnitId))
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        var conversionByPair = conversions.ToDictionary(
            x => (x.MaterialId, x.AlternativeUnitId),
            x => x.ConversionRate);

        var preparedItems = new Dictionary<long, (BOQItemInput Input, decimal ConversionRate)>();
        foreach (var item in request.Items)
        {
            if (!materialById.TryGetValue(item.MaterialId, out var material))
                throw new NotFoundException(nameof(MaterialCatalog), item.MaterialId);

            if (!unitById.TryGetValue(item.UnitId, out var unit))
                throw new NotFoundException(nameof(BPG.Domain.Entities.Unit), item.UnitId);

            decimal conversionRate;
            if (material.BaseUnitId == item.UnitId)
            {
                conversionRate = 1m;
            }
            else if (!conversionByPair.TryGetValue((item.MaterialId, item.UnitId), out conversionRate))
            {
                throw new BusinessException("ERR_INVALID_UNIT", $"Đơn vị tính không được hỗ trợ cho vật tư '{material.Name}'.");
            }

            if (unit.IsDiscrete && item.Quantity % 1 != 0)
            {
                throw new BusinessException(
                    ErrorCodes.InvalidUnitQuantity,
                    $"Đơn vị '{unit.UnitName}' yêu cầu số lượng phải là số nguyên.");
            }

            preparedItems[item.MaterialId] = (item, conversionRate);
        }

        var inUseMaterialIds = await PhaseBOQModificationGuard.GetInUseMaterialIdsAsync(
            _uow, request.PhaseId, cancellationToken);
        var newMaterialIds = request.Items.Select(i => i.MaterialId).ToHashSet();
        var deletedBOQItems = existingActive.Where(b => !newMaterialIds.Contains(b.MaterialId)).ToList();

        foreach (var deleted in deletedBOQItems)
        {
            if (inUseMaterialIds.Contains(deleted.MaterialId))
            {
                var materialName = materialById.GetValueOrDefault(deleted.MaterialId)?.Name
                    ?? deleted.MaterialId.ToString();
                throw new BusinessException("ERR_BOQ_ITEM_IN_USE", $"Không thể xóa vật tư '{materialName}' ra khỏi định mức do đã phát sinh yêu cầu cấp phát hoặc mua sắm.");
            }

            deleted.IsDeleted = true;
            _uow.Repository<BOQItem>().Update(deleted);
            _logger.LogInformation("Soft-deleted BOQ item Id: {BOQItemId} for MaterialId: {MaterialId} in PhaseId: {PhaseId}", deleted.BOQItemId, deleted.MaterialId, request.PhaseId);
        }

        foreach (var prepared in preparedItems.Values)
        {
            var item = prepared.Input;
            var conversionRate = prepared.ConversionRate;
            var material = materialById[item.MaterialId];
            var currentActive = existingActive.FirstOrDefault(x => x.MaterialId == item.MaterialId);
            if (currentActive != null)
            {
                var hasChanged = currentActive.Quantity != item.Quantity
                    || currentActive.UnitId != item.UnitId
                    || currentActive.ConversionRate != conversionRate;
                if (hasChanged && inUseMaterialIds.Contains(item.MaterialId))
                {
                    throw new BusinessException("ERR_BOQ_ITEM_IN_USE", $"Không thể thay đổi định mức vật tư '{material.Name}' do đã phát sinh yêu cầu cấp phát hoặc mua sắm.");
                }

                currentActive.Quantity = item.Quantity;
                currentActive.UnitId = item.UnitId;
                currentActive.ConversionRate = conversionRate;
                _uow.Repository<BOQItem>().Update(currentActive);
                _logger.LogInformation("Updated BOQ item Id: {BOQItemId} (Qty: {Quantity}) in PhaseId: {PhaseId}", currentActive.BOQItemId, item.Quantity, request.PhaseId);
            }
            else
            {
                var currentDeleted = existingAll.FirstOrDefault(x => x.MaterialId == item.MaterialId && x.IsDeleted);
                if (currentDeleted != null)
                {
                    currentDeleted.IsDeleted = false;
                    currentDeleted.Quantity = item.Quantity;
                    currentDeleted.UnitId = item.UnitId;
                    currentDeleted.ConversionRate = conversionRate;
                    _uow.Repository<BOQItem>().Update(currentDeleted);
                    _logger.LogInformation("Restored and updated BOQ item Id: {BOQItemId} (Qty: {Quantity}) in PhaseId: {PhaseId}", currentDeleted.BOQItemId, item.Quantity, request.PhaseId);
                }
                else
                {
                    var newBoq = new BOQItem
                    {
                        PhaseId = request.PhaseId,
                        MaterialId = item.MaterialId,
                        UnitId = item.UnitId,
                        Quantity = item.Quantity,
                        ConversionRate = conversionRate
                    };
                    await _uow.Repository<BOQItem>().AddAsync(newBoq, cancellationToken);
                    _logger.LogInformation("Added new BOQ item for MaterialId: {MaterialId} (Qty: {Quantity}) in PhaseId: {PhaseId}", item.MaterialId, item.Quantity, request.PhaseId);
                }
            }
        }

        await _uow.SaveChangesAsync(cancellationToken);

        return true;
    }
}
