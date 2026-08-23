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
    public record ProcessMaterialRequestByAccountantCommand(long RequestId, string Decision, string Note)
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
            if (!_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.Accountant))
            {
                throw new ForbiddenException("Chỉ Kế toán được phép thẩm định phương án cung ứng vật tư.");
            }

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

            if (mr.Status != MaterialRequestStatus.Pending)
            {
                throw new BusinessException("ERR_INVALID_STATUS_FOR_PROCESS", 
                    $"Phiếu yêu cầu vật tư đang ở trạng thái: {mr.Status}. Chỉ hỗ trợ xử lý phiếu ở trạng thái Chờ duyệt (Pending).");
            }

            if (!MaterialRequestProcurementDecision.IsValid(request.Decision))
            {
                throw new BusinessException(
                    "ERR_INVALID_PROCUREMENT_DECISION",
                    "Phương án cung ứng không hợp lệ.");
            }

            var note = request.Note?.Trim() ?? string.Empty;
            if (note.Length < 5)
            {
                throw new BusinessException(
                    "ERR_ACCOUNTANT_NOTE_REQUIRED",
                    "Ghi chú phải có ít nhất 5 ký tự.");
            }

            await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                mr.ProcurementDecision = request.Decision;
                mr.AccountantNote = note;
                mr.CheckedBy = currentUserId;
                mr.ApprovedBy = null;
                mr.UpdatedAt = DateTime.UtcNow;
                mr.UpdatedBy = currentUserId;

                mr.Status = MaterialRequestProcurementDecision.ResolveTechnicalStatus(
                    request.Decision,
                    mr.BOQCheckStatus);

                if (mr.Status == MaterialRequestStatus.Approved)
                {
                    mr.ApprovedBy = currentUserId;
                }

                _uow.Repository<MaterialRequest>().Update(mr);

                await _uow.SaveChangesAsync(cancellationToken);

                await BPG.Application.Common.Helpers.BOQStatusReevaluator.ReevaluateSiblingRequestsAsync(_uow, mr.PhaseId, mr.RequestId, cancellationToken);
                await _uow.SaveChangesAsync(cancellationToken);

                await _uow.CommitTransactionAsync(cancellationToken);

                // Gửi thông báo sau khi nghiệp vụ đã commit; lỗi thông báo không đảo ngược kết quả thẩm định.
                try
                {
                    var accountantUser = await _uow.Repository<User>().GetByIdAsync(currentUserId, cancellationToken);
                    var accountantName = accountantUser?.FullName ?? "Kế toán";

                    if (mr.Status == MaterialRequestStatus.Approved)
                    {
                        // 1. Phê duyệt trong định mức: thông báo cho Project Leader (người tạo)
                        if (mr.CreatedBy.HasValue)
                        {
                            await _notificationService.SendNotificationAsync(
                                mr.CreatedBy.Value,
                                "Yêu cầu vật tư đã được phê duyệt",
                                $"Yêu cầu vật tư cho giai đoạn '{mr.Phase?.Name}' của bạn đã được Kế toán '{accountantName}' phê duyệt.",
                                NotificationType.Procurement,
                                $"/projects/{mr.Phase?.ProjectId}/workspace/materialrequests",
                                mr.RequestId,
                                cancellationToken);
                        }
                    }
                    else if (mr.Status == MaterialRequestStatus.WaitingApproval)
                    {
                        // 2. Vượt định mức: thông báo trình Giám đốc duyệt
                        await _notificationService.SendNotificationToRoleAsync(
                            BPG.Domain.Constants.UserRole.Director,
                            "Yêu cầu vượt định mức chờ duyệt",
                            $"Kế toán '{accountantName}' vừa trình Giám đốc một yêu cầu vật tư vượt định mức giai đoạn '{mr.Phase?.Name}' thuộc dự án '{mr.Phase?.Project?.Name}'.",
                            NotificationType.Procurement,
                            $"/projects/{mr.Phase?.ProjectId}/workspace/materialrequests",
                            mr.RequestId,
                            cancellationToken);
                    }
                    else if (mr.Status == MaterialRequestStatus.Rejected && mr.CreatedBy.HasValue)
                    {
                        await _notificationService.SendNotificationAsync(
                            mr.CreatedBy.Value,
                            GetDecisionTitle(request.Decision),
                            $"Kế toán '{accountantName}' đã thẩm định yêu cầu vật tư cho giai đoạn '{mr.Phase?.Name}'. Ý kiến: {note}",
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

                string message = request.Decision switch
                {
                    MaterialRequestProcurementDecision.ExternalPurchase when mr.Status == MaterialRequestStatus.Approved
                        => "Đã phê duyệt yêu cầu trong định mức.",
                    MaterialRequestProcurementDecision.ExternalPurchase
                        => "Đã trình Giám đốc xem xét yêu cầu vượt định mức.",
                    MaterialRequestProcurementDecision.InternalTransfer
                        => "Đã ghi nhận đề nghị điều chuyển nội bộ.",
                    MaterialRequestProcurementDecision.WaitSupply
                        => "Đã ghi nhận chờ cung ứng.",
                    MaterialRequestProcurementDecision.NeedMoreInfo
                        => "Đã yêu cầu bổ sung thông tin. Phiếu có thể được chỉnh sửa và gửi lại.",
                    _ => "Đã ghi nhận từ chối yêu cầu vật tư."
                };

                return ApiResponse<bool>.SuccessResult(true, message);
            }
            catch (Exception)
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }
        }

        private static string GetDecisionTitle(string decision) => decision switch
        {
            MaterialRequestProcurementDecision.InternalTransfer => "Đề nghị điều chuyển vật tư nội bộ",
            MaterialRequestProcurementDecision.WaitSupply => "Yêu cầu vật tư được tạm hoãn cung ứng",
            MaterialRequestProcurementDecision.NeedMoreInfo => "Yêu cầu vật tư cần bổ sung thông tin",
            _ => "Yêu cầu vật tư không được chấp thuận"
        };
    }
}

