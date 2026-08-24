using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Common.Helpers
{
    public static class BOQStatusReevaluator
    {
        public static async Task ReevaluateSiblingRequestsAsync(IUnitOfWork uow, long phaseId, long? excludeRequestId, CancellationToken ct)
        {
            var itemRepo = uow.Repository<MaterialRequestItem>();
            var reqRepo = uow.Repository<MaterialRequest>();
            var boqRepo = uow.Repository<BOQItem>();

            // Lấy tất cả Pending requests trong cùng phase (trừ request đang bị loại trừ)
            var siblingRequests = await reqRepo.Query()
                .Include(r => r.Items)
                .Where(r => r.PhaseId == phaseId
                         && r.RequestId != excludeRequestId
                         && r.Status == MaterialRequestStatus.Pending
                         && !r.IsDeleted)
                .ToListAsync(ct);

            if (!siblingRequests.Any()) return;

            // Lấy tất cả BOQ items của phase
            var boqItems = await boqRepo.Query()
                .Where(b => b.PhaseId == phaseId && !b.IsDeleted)
                .ToListAsync(ct);

            foreach (var sibling in siblingRequests)
            {
                bool anyOverBOQ = false;

                foreach (var item in sibling.Items)
                {
                    var boq = boqItems.FirstOrDefault(b => b.MaterialId == item.MaterialId);
                    bool isOver = false;

                    if (boq == null)
                    {
                        isOver = true;
                    }
                    else
                    {
                        decimal boqLimitInBase = boq.Quantity / (boq.ConversionRate == 0 ? 1m : boq.ConversionRate);
                        decimal itemQtyInBase = item.Quantity / (item.ConversionRate == 0 ? 1m : item.ConversionRate);

                        // Tính tổng lượng đã giữ chỗ BOQ của các phiếu khác.
                        // InternalTransfer vẫn tính dù trạng thái kỹ thuật là Rejected.
                        decimal alreadyUsed = await itemRepo.Query()
                            .WhereCountsTowardBOQ()
                            .Where(ri => ri.Request.PhaseId == phaseId
                                      && ri.MaterialId == item.MaterialId
                                      && ri.RequestId != sibling.RequestId)
                            .SumAsync(ri => ri.Quantity / (ri.ConversionRate == 0 ? 1m : ri.ConversionRate), ct);

                        isOver = (alreadyUsed + itemQtyInBase) > boqLimitInBase;
                    }

                    if (item.IsOverBOQ != isOver)
                    {
                        item.IsOverBOQ = isOver;
                        item.Explanation = isOver ? "Yêu cầu vượt quá hạn mức định mức BOQ của Phase." : null;
                        itemRepo.Update(item);
                    }

                    if (isOver) anyOverBOQ = true;
                }

                var newStatus = anyOverBOQ ? BOQCheckStatus.OverBOQ : BOQCheckStatus.WithinBOQ;
                if (sibling.BOQCheckStatus != newStatus)
                {
                    sibling.BOQCheckStatus = newStatus;
                    reqRepo.Update(sibling);
                }
            }
        }
    }
}
