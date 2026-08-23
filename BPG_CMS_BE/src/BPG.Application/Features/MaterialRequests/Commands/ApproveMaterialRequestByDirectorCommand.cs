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

            if (mr.Phase?.Project?.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", "Dự án hiện không ở trạng thái hoạt động.");
            }

            if (mr.Status != MaterialRequestStatus.WaitingApproval)
            {
                throw new BusinessException("ERR_INVALID_STATUS_FOR_APPROVAL", 
                    $"Phiếu yêu cầu vật tư đang ở trạng thái: {mr.Status}. Chỉ hỗ trợ duyệt phiếu ở trạng thái Chờ Giám đốc duyệt (WaitingApproval).");
            }

            await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                // 1. Phê duyệt yêu cầu và lưu thông tin
                mr.Status = MaterialRequestStatus.Approved;
                mr.ApprovedBy = currentUserId;
                mr.ApprovalNote = request.Note;
                mr.UpdatedAt = DateTime.UtcNow;
                mr.UpdatedBy = currentUserId;

                _uow.Repository<MaterialRequest>().Update(mr);

                await _uow.SaveChangesAsync(cancellationToken);

                await BPG.Application.Common.Helpers.BOQStatusReevaluator.ReevaluateSiblingRequestsAsync(_uow, mr.PhaseId, mr.RequestId, cancellationToken);
                await _uow.SaveChangesAsync(cancellationToken);

                var directorUser = await _uow.Repository<User>().GetByIdAsync(currentUserId, cancellationToken);
                var directorName = directorUser?.FullName ?? "Giám đốc";

                // 1. Thông báo cho Project Leader (người tạo)
                if (mr.CreatedBy.HasValue)
                {
                    await _notificationService.SendNotificationAsync(
                        mr.CreatedBy.Value,
                        "Yêu cầu vượt định mức đã được duyệt",
                        $"Yêu cầu vượt định mức cho giai đoạn '{mr.Phase?.Name}' của bạn đã được Giám đốc '{directorName}' phê duyệt.",
                        NotificationType.Procurement,
                        $"/projects/{mr.Phase?.ProjectId}/workspace/materialrequests",
                        mr.RequestId,
                        cancellationToken);
                }

                // 2. Thông báo cho bộ phận Kế toán
                await _notificationService.SendNotificationToRoleAsync(
                    BPG.Domain.Constants.UserRole.Accountant,
                    "Yêu cầu vượt định mức đã được duyệt",
                    $"Giám đốc '{directorName}' đã phê duyệt yêu cầu vượt định mức giai đoạn '{mr.Phase?.Name}' thuộc dự án '{mr.Phase?.Project?.Name}'",
                    NotificationType.Procurement,
                    $"/projects/{mr.Phase?.ProjectId}/workspace/materialrequests",
                    mr.RequestId,
                    cancellationToken);

                await _uow.CommitTransactionAsync(cancellationToken);

                return ApiResponse<bool>.SuccessResult(true, "Giám đốc phê duyệt yêu cầu vật tư thành công.");
            }
            catch (Exception)
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }
        }
    }
}

