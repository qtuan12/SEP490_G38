using MediatR;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialRequests.Commands
{
    public record ApproveMaterialRequestByDirectorCommand(long RequestId, string? Note)
        : IRequest<ApiResponse<bool>>
    {
    }

    public class ApproveMaterialRequestByDirectorCommandHandler : IRequestHandler<ApproveMaterialRequestByDirectorCommand, ApiResponse<bool>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly INotificationService _notificationService;

        public ApproveMaterialRequestByDirectorCommandHandler(
            IUnitOfWork uow, 
            ICurrentUserService currentUserService,
            INotificationService notificationService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _notificationService = notificationService;
        }

        public async Task<ApiResponse<bool>> Handle(ApproveMaterialRequestByDirectorCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            var mr = await _uow.Repository<MaterialRequest>().Query()
                .Include(x => x.Items)
                .Include(x => x.Phase)
                    .ThenInclude(p => p.Project)
                .FirstOrDefaultAsync(x => x.RequestId == request.RequestId, cancellationToken);

            if (mr == null)
            {
                throw new NotFoundException(nameof(MaterialRequest), request.RequestId);
            }

            if (mr.Status != MaterialRequestStatus.WaitingApproval)
            {
                throw new BusinessException("ERR_INVALID_STATUS_FOR_APPROVAL", 
                    $"Phiáº¿u yÃªu cáº§u váº­t tÆ° Ä‘ang á»Ÿ tráº¡ng thÃ¡i: {mr.Status}. Chá»‰ há»— trá»£ duyá»‡t phiáº¿u á»Ÿ tráº¡ng thÃ¡i Chá» GiÃ¡m Ä‘á»‘c duyá»‡t (WaitingApproval).");
            }

            await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                // 1. PhÃª duyá»‡t yÃªu cáº§u vÃ  lÆ°u thÃ´ng tin
                mr.Status = MaterialRequestStatus.Approved;
                mr.ApprovedBy = currentUserId;
                mr.ApprovalNote = request.Note;
                mr.UpdatedAt = DateTime.UtcNow;
                mr.UpdatedBy = currentUserId;

                _uow.Repository<MaterialRequest>().Update(mr);

                await _uow.SaveChangesAsync(cancellationToken);
                await _uow.CommitTransactionAsync(cancellationToken);

                // Gá»­i thÃ´ng bÃ¡o realtime
                try
                {
                    var directorUser = await _uow.Repository<User>().GetByIdAsync(currentUserId, cancellationToken);
                    var directorName = directorUser?.FullName ?? "GiÃ¡m Ä‘á»‘c";

                    // 1. ThÃ´ng bÃ¡o cho Project Leader (ngÆ°á»i táº¡o)
                    if (mr.CreatedBy.HasValue)
                    {
                        await _notificationService.SendNotificationAsync(
                            mr.CreatedBy.Value,
                            "YÃªu cáº§u vÆ°á»£t Ä‘á»‹nh má»©c Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t",
                            $"YÃªu cáº§u vÆ°á»£t Ä‘á»‹nh má»©c cho giai Ä‘oáº¡n '{mr.Phase?.Name}' cá»§a báº¡n Ä‘Ã£ Ä‘Æ°á»£c GiÃ¡m Ä‘á»‘c '{directorName}' phÃª duyá»‡t.",
                            NotificationType.Procurement,
                            $"/projects/{mr.Phase?.ProjectId}/workspace/materialrequests",
                            mr.RequestId,
                            cancellationToken);
                    }

                    // 2. ThÃ´ng bÃ¡o cho bá»™ pháº­n Káº¿ toÃ¡n
                    await _notificationService.SendNotificationToRoleAsync(
                        BPG.Domain.Constants.UserRole.Accountant,
                        "YÃªu cáº§u vÆ°á»£t Ä‘á»‹nh má»©c Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t",
                        $"GiÃ¡m Ä‘á»‘c '{directorName}' Ä‘Ã£ phÃª duyá»‡t yÃªu cáº§u vÆ°á»£t Ä‘á»‹nh má»©c giai Ä‘oáº¡n '{mr.Phase?.Name}' thuá»™c dá»± Ã¡n '{mr.Phase?.Project?.Name}'",
                        NotificationType.Procurement,
                        $"/projects/{mr.Phase?.ProjectId}/workspace/materialrequests",
                        mr.RequestId,
                        cancellationToken);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error sending notification: {ex.Message}");
                }

                return ApiResponse<bool>.SuccessResult(true, "GiÃ¡m Ä‘á»‘c phÃª duyá»‡t yÃªu cáº§u váº­t tÆ° thÃ nh cÃ´ng.");
            }
            catch (Exception)
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }
        }
    }
}

