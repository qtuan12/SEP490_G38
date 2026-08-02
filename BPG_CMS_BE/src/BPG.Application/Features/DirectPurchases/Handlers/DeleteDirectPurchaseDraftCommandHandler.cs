using BPG.Application.Features.DirectPurchases.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.DirectPurchases.Handlers
{
    public class DeleteDirectPurchaseDraftCommandHandler : IRequestHandler<DeleteDirectPurchaseDraftCommand, bool>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;

        public DeleteDirectPurchaseDraftCommandHandler(IUnitOfWork uow, ICurrentUserService currentUserService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
        }

        public async Task<bool> Handle(DeleteDirectPurchaseDraftCommand request, CancellationToken ct)
        {
            long userId = _currentUserService.GetRequiredUserId();

            var dp = await _uow.Repository<DirectPurchaseRequest>().Query()
                .FirstOrDefaultAsync(r => r.DirectPurchaseId == request.DirectPurchaseId && !r.IsDeleted, ct)
                ?? throw new NotFoundException(nameof(DirectPurchaseRequest), request.DirectPurchaseId);

            if (dp.Status != DirectPurchaseStatus.Draft)
                throw new BusinessException("ERR_NOT_DRAFT",
                    $"Chỉ xóa được phiếu ở trạng thái Nháp. Trạng thái hiện tại: {dp.Status}.");

            if (dp.RequestedBy != userId)
                throw new ForbiddenException("Chỉ người tạo mới được xóa phiếu nháp này.");

            dp.IsDeleted = true;
            dp.UpdatedAt = DateTime.UtcNow;
            dp.UpdatedBy = userId;

            _uow.Repository<DirectPurchaseRequest>().Update(dp);
            await _uow.SaveChangesAsync(ct);

            return true;
        }
    }
}
