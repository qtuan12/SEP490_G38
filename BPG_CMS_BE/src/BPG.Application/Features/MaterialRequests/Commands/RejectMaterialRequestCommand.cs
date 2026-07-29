using MediatR;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialRequests.Commands
{
    public record RejectMaterialRequestCommand(long RequestId, string Reason)
        : IRequest<ApiResponse<bool>>
    {
    }

    public class RejectMaterialRequestCommandHandler : IRequestHandler<RejectMaterialRequestCommand, ApiResponse<bool>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly INotificationService _notificationService;

        public RejectMaterialRequestCommandHandler(
            IUnitOfWork uow, 
            ICurrentUserService currentUserService,
            INotificationService notificationService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _notificationService = notificationService;
        }

        public async Task<ApiResponse<bool>> Handle(RejectMaterialRequestCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                throw new BusinessException("ERR_REJECTION_REASON_REQUIRED", "Báº¯t buá»™c pháº£i nháº­p lÃ½ do tá»« chá»‘i yÃªu cáº§u.");
            }

            var mr = await _uow.Repository<MaterialRequest>().Query()
                .Include(x => x.Phase)
                .FirstOrDefaultAsync(x => x.RequestId == request.RequestId, cancellationToken);

            if (mr == null)
            {
                throw new NotFoundException(nameof(MaterialRequest), request.RequestId);
            }

            // Chá»‰ cho phÃ©p tá»« chá»‘i khi Ä‘ang chá» duyá»‡t hoáº·c chá» trÃ¬nh duyá»‡t
            if (mr.Status != MaterialRequestStatus.Pending && mr.Status != MaterialRequestStatus.WaitingApproval)
            {
                throw new BusinessException("ERR_INVALID_STATUS_FOR_REJECT", 
                    $"KhÃ´ng thá»ƒ tá»« chá»‘i yÃªu cáº§u váº­t tÆ° Ä‘ang á»Ÿ tráº¡ng thÃ¡i: {mr.Status}. Chá»‰ há»— trá»£ tá»« chá»‘i phiáº¿u á»Ÿ tráº¡ng thÃ¡i Chá» duyá»‡t (Pending) hoáº·c Chá» GiÃ¡m Ä‘á»‘c (WaitingApproval).");
            }

            var isAllowed = mr.Status == MaterialRequestStatus.Pending
                ? _currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.Accountant)
                : _currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.Director);
            if (!isAllowed)
            {
                throw new ForbiddenException();
            }

            if (mr.Status == MaterialRequestStatus.Pending)
            {
                mr.CheckedBy = currentUserId;
                mr.AccountantNote = $"Tá»« chá»‘i: {request.Reason}";
            }
            else // WaitingApproval
            {
                mr.ApprovedBy = currentUserId;
                mr.ApprovalNote = $"Tá»« chá»‘i: {request.Reason}";
            }

            mr.Status = MaterialRequestStatus.Rejected;
            mr.UpdatedAt = DateTime.UtcNow;
            mr.UpdatedBy = currentUserId;

            _uow.Repository<MaterialRequest>().Update(mr);
            await _uow.SaveChangesAsync(cancellationToken);

            // Gá»­i thÃ´ng bÃ¡o realtime
            try
            {
                var rejectUser = await _uow.Repository<User>().GetByIdAsync(currentUserId, cancellationToken);
                var rejectUserName = rejectUser?.FullName ?? "NgÆ°á»i duyá»‡t";

                if (mr.CreatedBy.HasValue)
                {
                    await _notificationService.SendNotificationAsync(
                        mr.CreatedBy.Value,
                        "YÃªu cáº§u váº­t tÆ° bá»‹ tá»« chá»‘i",
                        $"YÃªu cáº§u váº­t tÆ° cho giai Ä‘oáº¡n '{mr.Phase?.Name}' cá»§a báº¡n Ä‘Ã£ bá»‹ tá»« chá»‘i bá»Ÿi '{rejectUserName}'. LÃ½ do: {request.Reason}",
                        NotificationType.Procurement,
                        $"/projects/{mr.Phase?.ProjectId}/workspace/materialrequests",
                        mr.RequestId,
                        cancellationToken);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error sending notification: {ex.Message}");
            }

            return ApiResponse<bool>.SuccessResult(true, "Tá»« chá»‘i yÃªu cáº§u váº­t tÆ° thÃ nh cÃ´ng.");
        }
    }
}



