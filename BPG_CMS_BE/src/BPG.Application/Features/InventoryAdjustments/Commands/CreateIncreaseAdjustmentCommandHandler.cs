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
    public class CreateIncreaseAdjustmentCommandHandler : IRequestHandler<CreateIncreaseAdjustmentCommand, ApiResponse<long>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ICurrentUserService _currentUserService;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly INotificationService _notificationService;

        public CreateIncreaseAdjustmentCommandHandler(IUnitOfWork unitOfWork, ICurrentUserService currentUserService, IRealtimeNotificationSender realtimeSender, INotificationService notificationService)
        {
            _unitOfWork = unitOfWork;
            _currentUserService = currentUserService;
            _realtimeSender = realtimeSender;
            _notificationService = notificationService;
        }

        public async Task<ApiResponse<long>> Handle(CreateIncreaseAdjustmentCommand request, CancellationToken cancellationToken)
        {
            var project = await _unitOfWork.Repository<Project>().GetByIdAsync(request.ProjectId);
            if (project == null)
            {
                throw new NotFoundException(nameof(Project), request.ProjectId);
            }

            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", "Dự án đang tạm dừng, đã đóng hoặc chưa bắt đầu, không thể thực hiện thao tác này.");
            }

            var userId = _currentUserService.GetRequiredUserId();
            var isAdmin = _currentUserService.IsInRole(BPG.Domain.Constants.UserRole.Admin);
            var isProjectLeader = await _unitOfWork.Repository<ProjectMember>().AnyAsync(
                member => member.ProjectId == request.ProjectId && member.UserId == userId && member.IsLeader,
                cancellationToken);
            if (!isAdmin && !isProjectLeader)
                throw new ForbiddenException("Chỉ Trưởng dự án mới được tạo phiếu tăng tồn.");
            var phase = await _unitOfWork.Repository<Phase>().GetByIdAsync(request.PhaseId);
            if (phase == null)
            {
                throw new NotFoundException(nameof(Phase), request.PhaseId);
            }
            if (phase.ProjectId != request.ProjectId)
            {
                throw new BusinessException(ErrorCodes.InvalidTransition, "Giai đoạn không thuộc dự án này.");
            }

            if (request.Items.Select(x => x.MaterialId).Distinct().Count() != request.Items.Count)
            {
                throw new BusinessException("ERR_DUPLICATE_MATERIAL", "Danh sách vật tư không được chứa vật tư trùng lặp.");
            }

            var adjustment = new InventoryAdjustment
            {
                ProjectId = request.ProjectId,
                PhaseId = request.PhaseId,
                AdjustmentType = InventoryAdjustmentType.Increase,
                Reason = request.Reason,
                Description = request.Description,
                EvidenceUrl = request.EvidenceUrl,
                Status = InventoryAdjustmentStatus.Pending, // Require approval by TPKT
                CreatedBy = userId
            };

            var resolvedItems = await InventoryAdjustmentItemResolver.ResolveAsync(
                _unitOfWork,
                request.Items,
                cancellationToken);

            foreach (var resolvedItem in resolvedItems)
            {
                adjustment.Items.Add(new AdjustmentItem
                {
                    MaterialId = resolvedItem.Request.MaterialId,
                    UnitId = resolvedItem.UnitId,
                    Quantity = resolvedItem.Request.Quantity,
                    ConversionRate = resolvedItem.ConversionRate
                });
            }

            await _unitOfWork.Repository<InventoryAdjustment>().AddAsync(adjustment);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.TechnicalManager,
                "Phiếu điều chỉnh tăng tồn kho cần phê duyệt",
                $"Có phiếu tăng tồn kho mới (#{adjustment.AdjustmentId}) tại dự án {project.Name} đang chờ Trưởng phòng kỹ thuật phê duyệt.",
                BPG.Domain.Constants.NotificationType.Procurement,
                userId,
                $"/projects/{request.ProjectId}/workspace/inventoryadjustments",
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

            return ApiResponse<long>.SuccessResult(adjustment.AdjustmentId, "Tạo phiếu điều chỉnh tăng tồn thành công, chờ phê duyệt");
        }
    }
}
