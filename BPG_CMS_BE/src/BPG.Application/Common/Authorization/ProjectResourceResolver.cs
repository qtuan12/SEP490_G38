using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Common.Authorization;

public sealed class ProjectResourceResolver : IProjectResourceResolver
{
    private readonly IUnitOfWork _unitOfWork;

    public ProjectResourceResolver(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<long> ResolveProjectIdAsync(
        ProjectResource resource,
        CancellationToken ct = default)
    {
        if (resource.Id < 0)
            throw new NotFoundException(resource.Type.ToString(), resource.Id);

        if (resource.Type == ProjectResourceType.Project)
        {
            if (resource.Id == 0)
                throw new NotFoundException(nameof(Project), resource.Id);

            var exists = await _unitOfWork.Repository<Project>()
                .AnyAsync(project => project.ProjectId == resource.Id, ct);
            if (!exists)
                throw new NotFoundException(nameof(Project), resource.Id);

            return resource.Id;
        }

        var projectId = resource.Type switch
        {
            ProjectResourceType.Phase => await _unitOfWork.Repository<Phase>()
                .Query()
                .Where(item => item.PhaseId == resource.Id)
                .Select(item => (long?)item.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.Task => await _unitOfWork.Repository<ProjectTask>()
                .Query()
                .Where(item => item.TaskId == resource.Id)
                .Select(item => (long?)item.Phase.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.DailyLog => await _unitOfWork.Repository<DailyLog>()
                .Query()
                .Where(item => item.LogId == resource.Id)
                .Select(item => (long?)item.Task.Phase.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.Comment => await _unitOfWork.Repository<Comment>()
                .Query()
                .Where(item => item.CommentId == resource.Id)
                .Select(item => (long?)item.DailyLog.Task.Phase.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.MaterialRequest => await _unitOfWork.Repository<MaterialRequest>()
                .Query()
                .Where(item => item.RequestId == resource.Id)
                .Select(item => (long?)item.Phase.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.PurchaseOrder => await _unitOfWork.Repository<PurchaseOrder>()
                .Query()
                .Where(item => item.POId == resource.Id)
                .Select(item => (long?)item.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.GoodsReceipt => await _unitOfWork.Repository<GoodsReceipt>()
                .Query()
                .Where(item => item.ReceiptId == resource.Id)
                .Select(item => (long?)item.PurchaseOrder.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.DirectPurchase => await _unitOfWork.Repository<DirectPurchaseRequest>()
                .Query()
                .Where(item => item.DirectPurchaseId == resource.Id)
                .Select(item => (long?)item.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.InventoryAdjustment => await _unitOfWork.Repository<InventoryAdjustment>()
                .Query()
                .Where(item => item.AdjustmentId == resource.Id)
                .Select(item => (long?)item.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.Incident => await _unitOfWork.Repository<Incident>()
                .Query()
                .Where(item => item.IncidentId == resource.Id)
                .Select(item => (long?)item.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.PhaseAcceptance => await _unitOfWork.Repository<PhaseAcceptance>()
                .Query()
                .Where(item => item.AcceptanceId == resource.Id)
                .Select(item => (long?)item.Phase.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.MaterialIssuance => await _unitOfWork.Repository<MaterialIssuance>()
                .Query()
                .Where(item => item.MaterialIssuanceId == resource.Id)
                .Select(item => (long?)item.Task.Phase.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.MaterialReturn => await _unitOfWork.Repository<MaterialReturn>()
                .Query()
                .Where(item => item.MaterialReturnId == resource.Id)
                .Select(item => (long?)item.OriginalIssuance.Task.Phase.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.SurplusRequest => await _unitOfWork.Repository<SurplusRequest>()
                .Query()
                .Where(item => item.SurplusRequestId == resource.Id)
                .Select(item => (long?)item.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.SurplusRequestItem => await _unitOfWork.Repository<SurplusRequestItem>()
                .Query()
                .Where(item => item.SurplusRequestItemId == resource.Id)
                .Select(item => (long?)item.SurplusRequest.ProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.SurplusTransferSource => await _unitOfWork.Repository<SurplusTransfer>()
                .Query()
                .Where(item => item.SurplusTransferId == resource.Id)
                .Select(item => (long?)item.FromProjectId)
                .FirstOrDefaultAsync(ct),

            ProjectResourceType.SurplusTransferDestination => await _unitOfWork.Repository<SurplusTransfer>()
                .Query()
                .Where(item => item.SurplusTransferId == resource.Id)
                .Select(item => (long?)item.ToProjectId)
                .FirstOrDefaultAsync(ct),

            _ => null
        };

        return projectId is > 0
            ? projectId.Value
            : throw new NotFoundException(resource.Type.ToString(), resource.Id);
    }
}
