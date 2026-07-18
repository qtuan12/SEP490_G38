using BPG.Application.IRepositories;
using BPG.Application.IServices;
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

namespace BPG.Application.Features.Phases.Commands.UpdatePhaseBOQ;

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
        // 1. Verify Phase exists and belongs to Project
        var phase = await _uow.Repository<Phase>().Query()
            .Include(p => p.Project)
            .FirstOrDefaultAsync(p => p.PhaseId == request.PhaseId && p.ProjectId == request.ProjectId, cancellationToken);

        if (phase == null)
        {
            throw new NotFoundException("Phase", request.PhaseId);
        }

        // 2. Verify Phase is not frozen
        if (phase.Status == "frozen" || phase.Status == "Approved")
        {
            throw new BusinessException("ERR_PHASE_FROZEN", "Giai đoạn đã đóng băng nghiệm thu, không thể cập nhật BOQ.");
        }

        // 3. Fetch all existing BOQItems of the Phase (including soft-deleted ones)
        var existingAll = await _uow.Repository<BOQItem>().Query()
            .IgnoreQueryFilters()
            .Where(b => b.PhaseId == request.PhaseId)
            .ToListAsync(cancellationToken);

        var existingActive = existingAll.Where(b => !b.IsDeleted).ToList();

        // Load all Material Names in catalog to show in user-friendly error messages
        var allMatIds = request.Items.Select(i => i.MaterialId)
            .Concat(existingActive.Select(x => x.MaterialId))
            .Distinct()
            .ToList();

        var materialNames = await _uow.Repository<MaterialCatalog>().Query()
            .Where(m => allMatIds.Contains(m.MaterialId))
            .ToDictionaryAsync(m => m.MaterialId, m => m.Name, cancellationToken);

        // 4. Identify deleted items: currently active but not present in the new request list
        var newMaterialIds = request.Items.Select(i => i.MaterialId).ToHashSet();
        var deletedBOQItems = existingActive.Where(b => !newMaterialIds.Contains(b.MaterialId)).ToList();

        foreach (var deleted in deletedBOQItems)
        {
            // Check if material is referenced in any MaterialRequestItem in this phase
            var hasMR = await _uow.Repository<MaterialRequestItem>().Query()
                .AnyAsync(mri => mri.Request.PhaseId == request.PhaseId && mri.MaterialId == deleted.MaterialId && !mri.Request.IsDeleted, cancellationToken);

            // Check if material is referenced in any DirectPurchaseItem in this phase
            var hasDP = await _uow.Repository<DirectPurchaseItem>().Query()
                .AnyAsync(dpi => dpi.DirectPurchaseRequest.PhaseId == request.PhaseId && dpi.MaterialId == deleted.MaterialId && !dpi.DirectPurchaseRequest.IsDeleted, cancellationToken);

            // Check if material is referenced in any MaterialIssuanceItem in this phase
            var hasIssuance = await _uow.Repository<MaterialIssuanceItem>().Query()
                .AnyAsync(mii => mii.Issuance.Task.PhaseId == request.PhaseId && mii.MaterialId == deleted.MaterialId && !mii.Issuance.IsDeleted, cancellationToken);

            if (hasMR || hasDP || hasIssuance)
            {
                materialNames.TryGetValue(deleted.MaterialId, out var matName);
                throw new BusinessException("ERR_BOQ_ITEM_IN_USE", $"Không thể xóa vật tư '{matName ?? deleted.MaterialId.ToString()}' ra khỏi định mức do đã phát sinh yêu cầu cấp phát hoặc mua sắm.");
            }

            // Perform soft delete
            deleted.IsDeleted = true;
            _uow.Repository<BOQItem>().Update(deleted);
            _logger.LogInformation("Soft-deleted BOQ item Id: {BOQItemId} for MaterialId: {MaterialId} in PhaseId: {PhaseId}", deleted.BOQItemId, deleted.MaterialId, request.PhaseId);
        }

        // 5. Process new/updated BOQ items
        foreach (var item in request.Items)
        {
            var material = await _uow.Repository<MaterialCatalog>().Query()
                .FirstOrDefaultAsync(m => m.MaterialId == item.MaterialId, cancellationToken);
            if (material == null)
            {
                throw new NotFoundException("Material", item.MaterialId);
            }

            // Verify Unit & Conversion
            decimal conversionRate = 1.0m;
            if (material.BaseUnitId != item.UnitId)
            {
                var conversion = await _uow.Repository<MaterialConversion>().Query()
                    .FirstOrDefaultAsync(c => c.MaterialId == item.MaterialId && c.AlternativeUnitId == item.UnitId, cancellationToken);
                if (conversion == null)
                {
                    throw new BusinessException("ERR_INVALID_UNIT", $"Đơn vị tính không được hỗ trợ cho vật tư '{material.Name}'.");
                }
                conversionRate = conversion.ConversionRate;
            }

            var currentActive = existingActive.FirstOrDefault(x => x.MaterialId == item.MaterialId);
            if (currentActive != null)
            {
                // Check lock only if quantity is changed
                if (currentActive.Quantity != item.Quantity)
                {
                    var hasMR = await _uow.Repository<MaterialRequestItem>().Query()
                        .AnyAsync(mri => mri.Request.PhaseId == request.PhaseId && mri.MaterialId == item.MaterialId && !mri.Request.IsDeleted, cancellationToken);

                    var hasDP = await _uow.Repository<DirectPurchaseItem>().Query()
                        .AnyAsync(dpi => dpi.DirectPurchaseRequest.PhaseId == request.PhaseId && dpi.MaterialId == item.MaterialId && !dpi.DirectPurchaseRequest.IsDeleted, cancellationToken);

                    var hasIssuance = await _uow.Repository<MaterialIssuanceItem>().Query()
                        .AnyAsync(mii => mii.Issuance.Task.PhaseId == request.PhaseId && mii.MaterialId == item.MaterialId && !mii.Issuance.IsDeleted, cancellationToken);

                    if (hasMR || hasDP || hasIssuance)
                    {
                        throw new BusinessException("ERR_BOQ_ITEM_IN_USE", $"Không thể thay đổi định mức vật tư '{material.Name}' do đã phát sinh yêu cầu cấp phát hoặc mua sắm.");
                    }
                }

                currentActive.Quantity = item.Quantity;
                currentActive.UnitId = item.UnitId;
                currentActive.ConversionRate = conversionRate;
                _uow.Repository<BOQItem>().Update(currentActive);
                _logger.LogInformation("Updated BOQ item Id: {BOQItemId} (Qty: {Quantity}) in PhaseId: {PhaseId}", currentActive.BOQItemId, item.Quantity, request.PhaseId);
            }
            else
            {
                // Check if a soft-deleted item exists for the same Material
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
                    // Create new BOQItem
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

        // Gửi thông báo realtime
        try
        {
            var currentUserId = _currentUserService.GetRequiredUserId();
            var user = await _uow.Repository<User>().GetByIdAsync(currentUserId, cancellationToken);
            var userName = user?.FullName ?? "Quản lý";

            // 1. Gửi thông báo tới Technical Manager
            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.TechnicalManager,
                "Cập nhật định mức vật tư",
                $"Định mức vật tư giai đoạn '{phase.Name}' của dự án '{phase.Project?.Name}' vừa được cập nhật bởi '{userName}'.",
                NotificationType.Procurement,
                $"/projects/{phase.ProjectId}/phases/{phase.PhaseId}/boq",
                phase.PhaseId,
                cancellationToken);

            // 2. Gửi thông báo tới Project Leader (Chỉ huy trưởng) của dự án
            var projectLeader = await _uow.Repository<ProjectMember>().Query()
                .FirstOrDefaultAsync(pm => pm.ProjectId == phase.ProjectId && pm.IsLeader, cancellationToken);
            if (projectLeader != null && projectLeader.UserId != currentUserId)
            {
                await _notificationService.SendNotificationAsync(
                    projectLeader.UserId,
                    "Cập nhật định mức vật tư",
                    $"Định mức vật tư giai đoạn '{phase.Name}' vừa được cập nhật bởi '{userName}'.",
                    NotificationType.Procurement,
                    $"/projects/{phase.ProjectId}/phases/{phase.PhaseId}/boq",
                    phase.PhaseId,
                    cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending BOQ update notification");
        }

        return true;
    }
}
