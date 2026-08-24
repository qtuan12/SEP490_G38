using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Common.Helpers;

public static class PhaseBOQModificationGuard
{
    public static async Task<Phase> EnsureEditableAsync(
        IUnitOfWork uow,
        long projectId,
        long phaseId,
        CancellationToken ct)
    {
        var phase = await uow.Repository<Phase>().Query()
            .Include(p => p.Project)
            .FirstOrDefaultAsync(p => p.PhaseId == phaseId && p.ProjectId == projectId, ct);

        if (phase == null)
            throw new NotFoundException(nameof(Phase), phaseId);

        var isProjectEditable = phase.Project == null
            || string.Equals(phase.Project.Status, ProjectStatus.Draft, StringComparison.OrdinalIgnoreCase)
            || string.Equals(phase.Project.Status, ProjectStatus.InProgress, StringComparison.OrdinalIgnoreCase);

        if (!isProjectEditable)
            throw new BusinessException("ERR_BOQ_PROJECT_NOT_EDITABLE", "Không thể thay đổi định mức vật tư của dự án đã hoàn thành hoặc đã đóng.");

        var isPhaseEditable = !string.Equals(phase.Status, PhaseStatus.Approved, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(phase.Status, PhaseStatus.Completed, StringComparison.OrdinalIgnoreCase);

        if (!isPhaseEditable)
            throw new BusinessException("ERR_BOQ_PHASE_APPROVED", "Không thể thay đổi định mức vật tư của giai đoạn đã nghiệm thu hoặc hoàn thành.");

        if (phase.Project != null
            && string.Equals(phase.Project.Status, ProjectStatus.InProgress, StringComparison.OrdinalIgnoreCase))
        {
            var hasMaterialRequest = await uow.Repository<MaterialRequest>().Query()
                .WhereCountsTowardBOQ()
                .AnyAsync(r => r.PhaseId == phaseId, ct);

            var hasDirectPurchase = await uow.Repository<DirectPurchaseRequest>().Query()
                .AnyAsync(dp => dp.PhaseId == phaseId
                    && !dp.IsDeleted
                    && dp.Status != DirectPurchaseStatus.Rejected, ct);

            if (hasMaterialRequest || hasDirectPurchase)
                throw new BusinessException("ERR_BOQ_PHASE_IN_USE", "Không thể thay đổi định mức vật tư do giai đoạn đã phát sinh yêu cầu cấp phát hoặc mua sắm.");
        }

        return phase;
    }

    public static async Task<HashSet<long>> GetInUseMaterialIdsAsync(
        IUnitOfWork uow,
        long phaseId,
        CancellationToken ct)
    {
        var materialRequestIds = await uow.Repository<MaterialRequestItem>().Query()
            .Where(x => x.Request.PhaseId == phaseId && !x.Request.IsDeleted)
            .Select(x => x.MaterialId)
            .Distinct()
            .ToListAsync(ct);

        var directPurchaseIds = await uow.Repository<DirectPurchaseItem>().Query()
            .Where(x => x.DirectPurchaseRequest.PhaseId == phaseId && !x.DirectPurchaseRequest.IsDeleted)
            .Select(x => x.MaterialId)
            .Distinct()
            .ToListAsync(ct);

        var issuanceIds = await uow.Repository<MaterialIssuanceItem>().Query()
            .Where(x => x.Issuance.Task.PhaseId == phaseId && !x.Issuance.IsDeleted)
            .Select(x => x.MaterialId)
            .Distinct()
            .ToListAsync(ct);

        return materialRequestIds
            .Concat(directPurchaseIds)
            .Concat(issuanceIds)
            .ToHashSet();
    }
}
