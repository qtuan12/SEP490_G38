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
    /// <summary>
    /// Tạo phiếu mua trực tiếp ở trạng thái NHÁP.
    /// Validate nhẹ (dự án/giai đoạn/quyền/đơn vị tính) - phần validate đầy đủ nằm ở bước Submit.
    /// </summary>
    public class CreateDirectPurchaseRequestCommandHandler : IRequestHandler<CreateDirectPurchaseRequestCommand, long>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly IDirectPurchaseFulfillmentService _fulfillment;

        public CreateDirectPurchaseRequestCommandHandler(
            IUnitOfWork uow,
            ICurrentUserService currentUserService,
            IDirectPurchaseFulfillmentService fulfillment)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _fulfillment = fulfillment;
        }

        public async Task<long> Handle(CreateDirectPurchaseRequestCommand request, CancellationToken ct)
        {
            long userId = _currentUserService.GetRequiredUserId();

            var phase = await _uow.Repository<Phase>().Query()
                .FirstOrDefaultAsync(p => p.PhaseId == request.PhaseId, ct)
                ?? throw new NotFoundException(nameof(Phase), request.PhaseId);

            if (phase.ProjectId != request.ProjectId)
                throw new BusinessException("ERR_PHASE_PROJECT_MISMATCH", "Giai đoạn không thuộc dự án đã chọn.");

            await DirectPurchaseGuard.EnsureCanManageAsync(_uow, _currentUserService, phase.ProjectId, userId, ct);

            DirectPurchaseDraftWriter.EnsureNoDuplicateMaterial(request.Items);

            var resolved = await _fulfillment.ResolveItemsAsync(request.PhaseId, request.Items, ct);
            bool anyOverBOQ = await _fulfillment.EvaluateBoqAsync(request.PhaseId, null, resolved, ct);

            await _uow.BeginTransactionAsync(ct);
            try
            {
                var dp = new DirectPurchaseRequest
                {
                    ProjectId = request.ProjectId,
                    PhaseId = request.PhaseId,
                    TaskId = request.TaskId,
                    RequestedBy = userId,
                    Reason = request.Reason?.Trim() ?? string.Empty,
                    Status = DirectPurchaseStatus.Draft,
                    AuditStatus = DirectPurchaseAuditStatus.PendingAudit,
                    BOQCheckStatus = anyOverBOQ ? BOQCheckStatus.OverBOQ : BOQCheckStatus.WithinBOQ,
                    TotalAmount = resolved.Sum(i => i.LineTotal),
                    PurchaseDate = request.PurchaseDate,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userId,
                };

                await _uow.Repository<DirectPurchaseRequest>().AddAsync(dp, ct);
                await _uow.SaveChangesAsync(ct);

                await DirectPurchaseDraftWriter.ReplaceItemsAsync(_uow, dp.DirectPurchaseId, resolved, ct);
                await DirectPurchaseDraftWriter.ReplaceInvoicePhotosAsync(
                    _uow, dp.DirectPurchaseId, request.InvoicePhotoUrls, userId, ct);

                await _uow.SaveChangesAsync(ct);
                await _uow.CommitTransactionAsync(ct);

                return dp.DirectPurchaseId;
            }
            catch
            {
                await _uow.RollbackTransactionAsync(ct);
                throw;
            }
        }
    }
}
