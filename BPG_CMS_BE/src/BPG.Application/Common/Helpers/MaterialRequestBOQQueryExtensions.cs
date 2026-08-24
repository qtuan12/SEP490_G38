using BPG.Domain.Constants;
using BPG.Domain.Entities;

namespace BPG.Application.Common.Helpers;

public static class MaterialRequestBOQQueryExtensions
{
    public static IQueryable<MaterialRequestItem> WhereCountsTowardBOQ(
        this IQueryable<MaterialRequestItem> query) =>
        query.Where(item =>
            !item.Request.IsDeleted &&
            item.Request.Status != MaterialRequestStatus.Cancelled &&
            (item.Request.Status != MaterialRequestStatus.Rejected ||
             item.Request.ProcurementDecision == MaterialRequestProcurementDecision.InternalTransfer));

    public static IQueryable<MaterialRequest> WhereCountsTowardBOQ(
        this IQueryable<MaterialRequest> query) =>
        query.Where(request =>
            !request.IsDeleted &&
            request.Status != MaterialRequestStatus.Cancelled &&
            (request.Status != MaterialRequestStatus.Rejected ||
             request.ProcurementDecision == MaterialRequestProcurementDecision.InternalTransfer));
}
