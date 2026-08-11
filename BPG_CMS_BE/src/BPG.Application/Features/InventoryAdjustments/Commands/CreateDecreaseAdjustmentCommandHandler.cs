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

            if (project.Status != ProjectStatus.InProgress)
            {
                throw new BusinessException("ERR_PROJECT_NOT_ACTIVE", "Dự án đang tạm dừng, đã đóng hoặc chưa bắt đầu, không thể thực hiện thao tác này.");
            }

            var phase = await _unitOfWork.Repository<Phase>().GetByIdAsync(request.PhaseId);
            if (phase == null) throw new NotFoundException(nameof(Phase), request.PhaseId);
            if (phase.ProjectId != request.ProjectId) throw new BusinessException("ERR_INVALID_PHASE", "Giai đoạn không thuộc dự án này");

            if (request.Items.Select(x => x.MaterialId).Distinct().Count() != request.Items.Count)
            {
                throw new BusinessException("ERR_DUPLICATE_MATERIAL", "Danh sách vật tư không được chứa vật tư trùng lặp.");
            }

            var adjustment = new InventoryAdjustment
            {
                ProjectId = request.ProjectId,
                PhaseId = request.PhaseId,
                IncidentId = request.IncidentId,
                AdjustmentType = InventoryAdjustmentType.Decrease,
                Reason = request.Reason,
                Description = request.Description,
                Status = InventoryAdjustmentStatus.Pending, // Accountant creates, must be approved by Director
                CreatedBy = _currentUserService.UserId
            };

            if (request.IncidentId.HasValue && request.IncidentId.Value > 0)
            {
                var incident = await _unitOfWork.Repository<Incident>().GetByIdAsync(request.IncidentId.Value);
                if (incident != null && (incident.Status == "WaitingAccountant" || incident.Status == "Reported"))
                {
                    incident.Status = "WaitingDirector";
                    if (!string.IsNullOrWhiteSpace(request.Description))
                    {
                        incident.HandlingInstruction = request.Description;
                    }
                    _unitOfWork.Repository<Incident>().Update(incident);
                }
            }

            foreach (var item in request.Items)
            {
                var material = await _unitOfWork.Repository<MaterialCatalog>().Query()
                    .Include(m => m.BaseUnit)
                    .FirstOrDefaultAsync(m => m.MaterialId == item.MaterialId, cancellationToken);
                if (material == null) throw new NotFoundException(nameof(MaterialCatalog), item.MaterialId);

                if (material.BaseUnit != null && material.BaseUnit.IsDiscrete && item.Quantity % 1 != 0)
                {
                    throw new BusinessException(ErrorCodes.InvalidUnitQuantity, 
                        $"Đơn vị tính '{material.BaseUnit.UnitName}' của vật tư [{material.Name}] yêu cầu số lượng phải là số nguyên.");
                }

                var currentInventory = await _unitOfWork.Repository<CurrentInventory>()
                    .FirstOrDefaultAsync(
                        inventory => inventory.ProjectId == request.ProjectId && inventory.MaterialId == item.MaterialId,
                        cancellationToken);
                var availableQuantity = currentInventory?.Quantity - currentInventory?.ReservedQuantity ?? 0;
                if (currentInventory == null || availableQuantity < item.Quantity)
                {
                    throw new InsufficientStockException(
                        material.Name,
                        availableQuantity,
                        item.Quantity,
                        material.BaseUnit?.UnitName ?? "đơn vị");
                }

                currentInventory.ReservedQuantity += item.Quantity;
                currentInventory.LastUpdated = System.DateTime.UtcNow;
                _unitOfWork.Repository<CurrentInventory>().Update(currentInventory);

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

            // The physical quantity is unchanged until approval, but the pending decrease is
            // reserved immediately so other outbound flows cannot consume damaged/lost stock.

            // Gửi thông báo DB đến Giám đốc để phê duyệt
            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Director,
                "Phiếu điều chỉnh giảm tồn kho cần phê duyệt",
                $"Kế toán vừa tạo phiếu giảm tồn kho #{adjustment.AdjustmentId} tại dự án {project.Name} đang chờ Giám đốc phê duyệt.",
                BPG.Domain.Constants.NotificationType.Procurement,
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

            return ApiResponse<long>.SuccessResult(adjustment.AdjustmentId, "Tạo phiếu điều chỉnh giảm tồn thành công, chờ phê duyệt");
        }
    }
}
