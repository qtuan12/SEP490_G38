using BPG.Application.Features.PurchaseOrders.Queries;
using BPG.Application.Features.PurchaseOrders.Services;
using BPG.Application.IRepositories;
using MediatR;

namespace BPG.Application.Features.PurchaseOrders.Handlers
{
    public class GetNextPoNumberQueryHandler : IRequestHandler<GetNextPoNumberQuery, string>
    {
        private readonly IUnitOfWork _uow;

        public GetNextPoNumberQueryHandler(IUnitOfWork uow) => _uow = uow;

        public async Task<string> Handle(GetNextPoNumberQuery request, CancellationToken cancellationToken)
        {
            // Dùng chung bộ sinh với CreatePurchaseOrderCommandHandler để hai nơi không lệch nhau.
            // Chỉ để xem trước: mã thật được sinh lại lúc tạo PO nên có thể khác nếu có PO khác
            // được tạo xen vào giữa.
            return await PoNumberGenerator.NextAsync(_uow, request.OrderDate, cancellationToken);
        }
    }
}
