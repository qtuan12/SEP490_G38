using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    public class AuditDirectPurchaseCommand : IRequest<bool>
    {
        public long DirectPurchaseId { get; set; }
        /// <summary>true = Đã kiểm toán/hoàn tiền, false = Từ chối kiểm toán.</summary>
        public bool Approve { get; set; }
        public string? AuditNote { get; set; }
    }

    public class AuditDirectPurchaseCommandHandler : IRequestHandler<AuditDirectPurchaseCommand, bool>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;

        public AuditDirectPurchaseCommandHandler(IUnitOfWork uow, ICurrentUserService currentUserService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
        }

        public async Task<bool> Handle(AuditDirectPurchaseCommand request, CancellationToken ct)
        {
            long userId = _currentUserService.GetRequiredUserId();

            var dp = await _uow.Repository<DirectPurchaseRequest>().Query()
                .FirstOrDefaultAsync(r => r.DirectPurchaseId == request.DirectPurchaseId, ct)
                ?? throw new NotFoundException(nameof(DirectPurchaseRequest), request.DirectPurchaseId);

            if (dp.AuditStatus != DirectPurchaseAuditStatus.PendingAudit)
                throw new BusinessException("ALREADY_AUDITED",
                    "Phiếu này đã được kiểm toán, không thể thao tác lại.");

            if (!request.Approve && string.IsNullOrWhiteSpace(request.AuditNote))
                throw new BusinessException("NOTE_REQUIRED",
                    "Vui lòng nhập lý do khi từ chối kiểm toán.");

            dp.AuditStatus = request.Approve
                ? DirectPurchaseAuditStatus.Audited
                : DirectPurchaseAuditStatus.Rejected;
            dp.AuditedBy = userId;
            dp.AuditedAt = DateTime.UtcNow;
            dp.AuditNote = request.AuditNote?.Trim();

            _uow.Repository<DirectPurchaseRequest>().Update(dp);
            await _uow.SaveChangesAsync(ct);

            return true;
        }
    }
}
