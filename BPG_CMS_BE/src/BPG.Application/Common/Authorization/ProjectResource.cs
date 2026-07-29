using BPG.Domain.Constants;

namespace BPG.Application.Common.Authorization;

public enum ProjectResourceType
{
    Project,
    Phase,
    Task,
    DailyLog,
    Comment,
    MaterialRequest,
    PurchaseOrder,
    GoodsReceipt,
    DirectPurchase,
    InventoryAdjustment,
    Incident,
    PhaseAcceptance,
    MaterialIssuance,
    MaterialReturn,
    SurplusRequest,
    SurplusRequestItem,
    SurplusTransferSource,
    SurplusTransferDestination
}

public readonly record struct ProjectResource(ProjectResourceType Type, long Id)
{
    public static ProjectResource Project(long id) => new(ProjectResourceType.Project, id);
    public static ProjectResource Phase(long id) => new(ProjectResourceType.Phase, id);
    public static ProjectResource Task(long id) => new(ProjectResourceType.Task, id);
    public static ProjectResource DailyLog(long id) => new(ProjectResourceType.DailyLog, id);
    public static ProjectResource Comment(long id) => new(ProjectResourceType.Comment, id);
    public static ProjectResource MaterialRequest(long id) => new(ProjectResourceType.MaterialRequest, id);
    public static ProjectResource PurchaseOrder(long id) => new(ProjectResourceType.PurchaseOrder, id);
    public static ProjectResource GoodsReceipt(long id) => new(ProjectResourceType.GoodsReceipt, id);
    public static ProjectResource DirectPurchase(long id) => new(ProjectResourceType.DirectPurchase, id);
    public static ProjectResource InventoryAdjustment(long id) => new(ProjectResourceType.InventoryAdjustment, id);
    public static ProjectResource Incident(long id) => new(ProjectResourceType.Incident, id);
    public static ProjectResource PhaseAcceptance(long id) => new(ProjectResourceType.PhaseAcceptance, id);
    public static ProjectResource MaterialIssuance(long id) => new(ProjectResourceType.MaterialIssuance, id);
    public static ProjectResource MaterialReturn(long id) => new(ProjectResourceType.MaterialReturn, id);
    public static ProjectResource SurplusRequest(long id) => new(ProjectResourceType.SurplusRequest, id);
    public static ProjectResource SurplusRequestItem(long id) => new(ProjectResourceType.SurplusRequestItem, id);
    public static ProjectResource SurplusTransferSource(long id) => new(ProjectResourceType.SurplusTransferSource, id);
    public static ProjectResource SurplusTransferDestination(long id) => new(ProjectResourceType.SurplusTransferDestination, id);
}

public interface IProjectResourceRequirement
{
    ProjectResource ProjectResource { get; }
    string RequiredPermission => ProjectPermission.View;
}

public interface IProjectResourceResolver
{
    Task<long> ResolveProjectIdAsync(ProjectResource resource, CancellationToken ct = default);
}
