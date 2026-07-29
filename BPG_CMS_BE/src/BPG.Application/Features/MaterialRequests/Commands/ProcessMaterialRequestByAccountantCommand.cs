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
    public record ProcessMaterialRequestByAccountantCommand(long RequestId, string? Note)
        : IRequest<ApiResponse<bool>>
    {
    }

    public class ProcessMaterialRequestByAccountantCommandHandler : IRequestHandler<ProcessMaterialRequestByAccountantCommand, ApiResponse<bool>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;
        private readonly INotificationService _notificationService;

        public ProcessMaterialRequestByAccountantCommandHandler(
            IUnitOfWork uow, 
            ICurrentUserService currentUserService,
            INotificationService notificationService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
            _notificationService = notificationService;
        }

        public async Task<ApiResponse<bool>> Handle(ProcessMaterialRequestByAccountantCommand request, CancellationToken cancellationToken)
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

            if (mr.Status != MaterialRequestStatus.Pending)
            {
                throw new BusinessException("ERR_INVALID_STATUS_FOR_PROCESS", 
                    $"Phiáº¿u yÃªu cáº§u váº­t tÆ° Ä‘ang á»Ÿ tráº¡ng thÃ¡i: {mr.Status}. Chá»‰ há»— trá»£ xá»­ lÃ½ phiáº¿u á»Ÿ tráº¡ng thÃ¡i Chá» duyá»‡t (Pending).");
            }

            await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                if (mr.BOQCheckStatus == BOQCheckStatus.WithinBOQ)
                {
                    // 1. PhÃª duyá»‡t trá»±c tiáº¿p vÃ  cáº­p nháº­t thÃ´ng tin kiá»ƒm tra/phÃª duyá»‡t
                    mr.Status = MaterialRequestStatus.Approved;
                    mr.CheckedBy = currentUserId;
                    mr.ApprovedBy = currentUserId;
                    mr.AccountantNote = request.Note;
                    mr.UpdatedAt = DateTime.UtcNow;
                    mr.UpdatedBy = currentUserId;

                    _uow.Repository<MaterialRequest>().Update(mr);
                }
                else
                {
                    // TrÃ¬nh GiÃ¡m Ä‘á»‘c phÃª duyá»‡t (WaitingApproval)
                    mr.Status = MaterialRequestStatus.WaitingApproval;
                    mr.CheckedBy = currentUserId;
                    mr.AccountantNote = request.Note;
                    mr.UpdatedAt = DateTime.UtcNow;
                    mr.UpdatedBy = currentUserId;

                    _uow.Repository<MaterialRequest>().Update(mr);
                }

                await _uow.SaveChangesAsync(cancellationToken);
                await _uow.CommitTransactionAsync(cancellationToken);

                // Gá»­i thÃ´ng bÃ¡o realtime
                try
                {
                    var accountantUser = await _uow.Repository<User>().GetByIdAsync(currentUserId, cancellationToken);
                    var accountantName = accountantUser?.FullName ?? "Káº¿ toÃ¡n";

                    if (mr.Status == MaterialRequestStatus.Approved)
                    {
                        // 1. PhÃª duyá»‡t trong Ä‘á»‹nh má»©c: thÃ´ng bÃ¡o cho Project Leader (ngÆ°á»i táº¡o)
                        if (mr.CreatedBy.HasValue)
                        {
                            await _notificationService.SendNotificationAsync(
                                mr.CreatedBy.Value,
                                "YÃªu cáº§u váº­t tÆ° Ä‘Ã£ Ä‘Æ°á»£c phÃª duyá»‡t",
                                $"YÃªu cáº§u váº­t tÆ° cho giai Ä‘oáº¡n '{mr.Phase?.Name}' cá»§a báº¡n Ä‘Ã£ Ä‘Æ°á»£c Káº¿ toÃ¡n '{accountantName}' phÃª duyá»‡t.",
                                NotificationType.Procurement,
                                $"/projects/{mr.Phase?.ProjectId}/workspace/materialrequests",
                                mr.RequestId,
                                cancellationToken);
                        }
                    }
                    else if (mr.Status == MaterialRequestStatus.WaitingApproval)
                    {
                        // 2. VÆ°á»£t Ä‘á»‹nh má»©c: thÃ´ng bÃ¡o trÃ¬nh GiÃ¡m Ä‘á»‘c duyá»‡t
                        await _notificationService.SendNotificationToRoleAsync(
                            BPG.Domain.Constants.UserRole.Director,
                            "YÃªu cáº§u vÆ°á»£t Ä‘á»‹nh má»©c chá» duyá»‡t",
                            $"Káº¿ toÃ¡n '{accountantName}' vá»«a trÃ¬nh GiÃ¡m Ä‘á»‘c má»™t yÃªu cáº§u váº­t tÆ° vÆ°á»£t Ä‘á»‹nh má»©c giai Ä‘oáº¡n '{mr.Phase?.Name}' thuá»™c dá»± Ã¡n '{mr.Phase?.Project?.Name}'.",
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

                string message = mr.Status == MaterialRequestStatus.Approved 
                    ? "Káº¿ toÃ¡n phÃª duyá»‡t yÃªu cáº§u trong Ä‘á»‹nh má»©c thÃ nh cÃ´ng." 
                    : "Káº¿ toÃ¡n trÃ¬nh GiÃ¡m Ä‘á»‘c xem xÃ©t yÃªu cáº§u vÆ°á»£t Ä‘á»‹nh má»©c thÃ nh cÃ´ng.";

                return ApiResponse<bool>.SuccessResult(true, message);
            }
            catch (Exception)
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }
        }
    }
}

