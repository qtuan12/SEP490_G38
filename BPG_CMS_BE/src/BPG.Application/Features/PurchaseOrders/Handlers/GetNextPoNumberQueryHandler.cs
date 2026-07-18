using BPG.Application.Features.PurchaseOrders.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PurchaseOrders.Handlers
{
    public class GetNextPoNumberQueryHandler : IRequestHandler<GetNextPoNumberQuery, string>
    {
        private readonly IUnitOfWork _uow;

        public GetNextPoNumberQueryHandler(IUnitOfWork uow) => _uow = uow;

        public async Task<string> Handle(GetNextPoNumberQuery request, CancellationToken cancellationToken)
        {
            // Cùng logic sinh mã với CreatePurchaseOrderCommandHandler — chỉ dùng để xem trước,
            // mã thực tế được sinh lại tại thời điểm tạo PO nên có thể lệch nếu có PO khác được tạo xen giữa.
            var prefix = $"PO-{request.OrderDate:yyyyMMdd}-";
            var todayCount = await _uow.Repository<PurchaseOrder>().Query()
                .CountAsync(po => po.PONumber.StartsWith(prefix), cancellationToken);
            return $"{prefix}{(todayCount + 1):D4}";
        }
    }
}
