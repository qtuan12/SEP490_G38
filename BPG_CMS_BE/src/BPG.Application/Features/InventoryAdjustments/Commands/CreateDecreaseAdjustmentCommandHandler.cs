using BPG.Domain.Exceptions;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Models;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.InventoryAdjustments.Commands
{
    public class CreateDecreaseAdjustmentCommandHandler : IRequestHandler<CreateDecreaseAdjustmentCommand, ApiResponse<long>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ICurrentUserService _currentUserService;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;

        public CreateDecreaseAdjustmentCommandHandler(IUnitOfWork unitOfWork, ICurrentUserService currentUserService, IRealtimeNotificationSender realtimeSender, INotificationService notificationService)
        {
            _unitOfWork = unitOfWork;
            _currentUserService = currentUserService;
            _realtimeSender = realtimeSender;
            _notificationService = notificationService;
        }

        public async Task<ApiResponse<long>> Handle(CreateDecreaseAdjustmentCommand request, CancellationToken cancellationToken)
        {
            var project = await _unitOfWork.Repository<Project>().GetByIdAsync(request.ProjectId);
            if (project == null) throw new NotFoundException(nameof(Project), request.ProjectId);

            var phase = await _unitOfWork.Repository<Phase>().GetByIdAsync(request.PhaseId);
            if (phase == null) throw new NotFoundException(nameof(Phase), request.PhaseId);
            if (phase.ProjectId != request.ProjectId) throw new BusinessException("ERR_INVALID_PHASE", "Giai đoạn không thuộc dự án này");

            var adjustment = new InventoryAdjustment
            {
                ProjectId = request.ProjectId,
                PhaseId = request.PhaseId,
                AdjustmentType = InventoryAdjustmentType.Decrease,
                Reason = request.Reason,
                Description = request.Description,
                Status = InventoryAdjustmentStatus.Pending // Accountant creates, must be approved by Director
            };

            foreach (var item in request.Items)
            {
                var material = await _unitOfWork.Repository<MaterialCatalog>().GetByIdAsync(item.MaterialId);
                if (material == null) throw new NotFoundException(nameof(MaterialCatalog), item.MaterialId);

                adjustment.Items.Add(new AdjustmentItem
                {
                    MaterialId = item.MaterialId,
                    UnitId = material.BaseUnitId,
                    Quantity = item.Quantity,
                    ConversionRate = 1
                });
            }

            await _unitOfWork.Repository<InventoryAdjustment>().AddAsync(adjustment);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            // Note: Decrease does not update CurrentInventory nor create InventoryTransaction yet.
            // It waits for Approval.

            // Gửi thông báo DB đến Giám đốc để phê duyệt
            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Director,
                "Phiếu điều chỉnh giảm tồn kho cần phê duyệt",
                $"Kế toán vừa tạo phiếu giảm tồn kho #{adjustment.AdjustmentId} tại dự án {project.Name} đang chờ Giám đốc phê duyệt.",
                BPG.Domain.Constants.NotificationType.Procurement,
                BPG.Domain.Constants.NotificationReferenceType.InventoryAdjustment,
                adjustment.AdjustmentId,
                cancellationToken
            );

            // Realtime: broadcast to all members currently viewing this project
            await _realtimeSender.SendToGroupAsync(
                HubMethodNames.GroupProject + request.ProjectId,
                HubMethodNames.InventoryAdjustmentCreated,
                adjustment.AdjustmentId,
                cancellationToken);

            // Realtime: broadcast to all members viewing global incidents (Project_0)
            await _realtimeSender.SendToGroupAsync(
                HubMethodNames.GroupProject + 0,
                HubMethodNames.InventoryAdjustmentCreated,
                adjustment.AdjustmentId,
                cancellationToken);

            return ApiResponse<long>.SuccessResult(adjustment.AdjustmentId, "Tạo phiếu điều chỉnh giảm tồn thành công, chờ phê duyệt");
        }
    }
}
