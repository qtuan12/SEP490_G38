using BPG.Application.Features.DirectPurchases.Commands;
using BPG.Application.Features.DirectPurchases.Services;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.DirectPurchases.Handlers
{
    public class UpdateDirectPurchaseDraftCommandHandler : IRequestHandler<UpdateDirectPurchaseDraftCommand, bool>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IDirectPurchaseFulfillmentService _fulfillment;

        public UpdateDirectPurchaseDraftCommandHandler(
            IUnitOfWork uow,
            ICurrentUserService currentUserService,
            IDirectPurchaseFulfillmentService fulfillment)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _fulfillment = fulfillment;
        }

        public async Task<bool> Handle(UpdateDirectPurchaseDraftCommand request, CancellationToken ct)
        {
            long userId = _currentUserService.GetRequiredUserId();

            var dp = await _uow.Repository<DirectPurchaseRequest>().Query()
                .FirstOrDefaultAsync(r => r.DirectPurchaseId == request.DirectPurchaseId && !r.IsDeleted, ct)
                ?? throw new NotFoundException(nameof(DirectPurchaseRequest), request.DirectPurchaseId);

            if (dp.Status != DirectPurchaseStatus.Draft)
                throw new BusinessException("ERR_NOT_DRAFT",
                    $"Chỉ sửa được phiếu ở trạng thái Nháp. Trạng thái hiện tại: {dp.Status}.");

            if (dp.RequestedBy != userId)
                throw new ForbiddenException("Chỉ người tạo mới được sửa phiếu nháp này.");

            var phase = await _uow.Repository<Phase>().Query()
                .FirstOrDefaultAsync(p => p.PhaseId == request.PhaseId, ct)
                ?? throw new NotFoundException(nameof(Phase), request.PhaseId);

            if (phase.ProjectId != dp.ProjectId)
                throw new BusinessException("ERR_PHASE_PROJECT_MISMATCH", "Giai đoạn không thuộc dự án của phiếu.");

            await DirectPurchaseGuard.EnsureCanManageAsync(_uow, _currentUserService, dp.ProjectId, userId, ct);

            DirectPurchaseDraftWriter.EnsureNoDuplicateMaterial(request.Items);

            var resolved = await _fulfillment.ResolveItemsAsync(request.PhaseId, request.Items, ct);
            bool anyOverBOQ = await _fulfillment.EvaluateBoqAsync(request.PhaseId, dp.DirectPurchaseId, resolved, ct);

            await _uow.BeginTransactionAsync(ct);
            try
            {
                dp.PhaseId = request.PhaseId;
                dp.TaskId = request.TaskId;
                dp.Reason = request.Reason?.Trim() ?? string.Empty;
                dp.PurchaseDate = request.PurchaseDate;
                dp.BOQCheckStatus = anyOverBOQ ? BOQCheckStatus.OverBOQ : BOQCheckStatus.WithinBOQ;
                dp.TotalAmount = resolved.Sum(i => i.LineTotal);
                dp.UpdatedAt = DateTime.UtcNow;
                dp.UpdatedBy = userId;

                _uow.Repository<DirectPurchaseRequest>().Update(dp);

                await DirectPurchaseDraftWriter.ReplaceItemsAsync(_uow, dp.DirectPurchaseId, resolved, ct);
                await DirectPurchaseDraftWriter.ReplaceInvoicePhotosAsync(
                    _uow, dp.DirectPurchaseId, request.InvoicePhotoUrls, userId, ct);

                await _uow.SaveChangesAsync(ct);
                await _uow.CommitTransactionAsync(ct);

                return true;
            }
            catch
            {
                await _uow.RollbackTransactionAsync(ct);
                throw;
            }
        }
    }
}
