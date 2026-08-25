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

            Incident? linkedIncident = null;
            InventoryAdjustment? adjustmentToResubmit = null;
            if (request.IncidentId.HasValue)
            {
                linkedIncident = await _unitOfWork.Repository<Incident>().GetByIdAsync(
                    request.IncidentId.Value,
                    cancellationToken);
                if (linkedIncident == null)
                {
                    throw new NotFoundException(nameof(Incident), request.IncidentId.Value);
                }

                if (linkedIncident.ProjectId != request.ProjectId)
                {
                    throw new BusinessException("ERR_INVALID_INCIDENT", "Sự cố được chọn không thuộc về dự án này.");
                }

                if (linkedIncident.PhaseId != request.PhaseId)
                {
                    throw new BusinessException("ERR_INVALID_INCIDENT", "Sự cố được chọn không thuộc giai đoạn này.");
                }

                var isInventoryIncident = linkedIncident.IncidentType == "InventoryLoss"
                    || linkedIncident.IncidentType == "InventoryDamage";
                if (!isInventoryIncident)
                {
                    throw new BusinessException("ERR_INVALID_INCIDENT", "Chỉ được liên kết phiếu giảm tồn kho với sự cố vật tư kho.");
                }

                if (linkedIncident.Status != IncidentStatus.WaitingAccountant
                    && linkedIncident.Status != IncidentStatus.UnderResolution)
                {
                    throw new BusinessException(
                        "ERR_INVALID_INCIDENT_STATUS",
                        "Chỉ có thể tạo phiếu giảm tồn khi sự cố đang chờ Kế toán xác minh hoặc đang xử lý.");
                }

                var linkedAdjustments = await _unitOfWork.Repository<InventoryAdjustment>()
                    .Query()
                    .Include(adjustment => adjustment.Items)
                    .Where(adjustment => adjustment.IncidentId == request.IncidentId.Value)
                    .OrderByDescending(adjustment => adjustment.AdjustmentId)
                    .ToListAsync(cancellationToken);

                if (linkedAdjustments.Any(
                    adjustment => adjustment.Status == InventoryAdjustmentStatus.Pending))
                {
                    throw new BusinessException(
                        "ERR_INCIDENT_ALREADY_ADJUSTED",
                        "Sự cố này đã có phiếu giảm tồn đang chờ duyệt.");
                }

                // A director rejection is a request to revise the same document, not
                // permission to create another adjustment for the same incident.
                adjustmentToResubmit = linkedAdjustments.FirstOrDefault(
                    adjustment => adjustment.Status == InventoryAdjustmentStatus.RevisionRequired);
            }

            var isResubmission = adjustmentToResubmit != null;
            var adjustment = adjustmentToResubmit ?? new InventoryAdjustment
            {
                ProjectId = request.ProjectId,
                PhaseId = request.PhaseId,
                IncidentId = linkedIncident?.IncidentId,
                AdjustmentType = InventoryAdjustmentType.Decrease,
                CreatedBy = _currentUserService.GetRequiredUserId()
            };

            var resolvedItems = await InventoryAdjustmentItemResolver.ResolveAsync(
                _unitOfWork,
                request.Items,
                cancellationToken);

            foreach (var resolvedItem in resolvedItems)
            {
                var currentInventory = await _unitOfWork.Repository<CurrentInventory>()
                    .FirstOrDefaultAsync(
                        inventory => inventory.ProjectId == request.ProjectId
                            && inventory.MaterialId == resolvedItem.Request.MaterialId,
                        cancellationToken);
                var availableQuantity = currentInventory?.Quantity - currentInventory?.ReservedQuantity ?? 0;
                if (currentInventory == null || availableQuantity < resolvedItem.BaseQuantity)
                {
                    throw new InsufficientStockException(
                        resolvedItem.Material.Name,
                        availableQuantity,
                        resolvedItem.BaseQuantity,
                        resolvedItem.Material.BaseUnit?.UnitName ?? "đơn vị");
                }

                currentInventory.ReservedQuantity += resolvedItem.BaseQuantity;
                currentInventory.LastUpdated = System.DateTime.UtcNow;
                _unitOfWork.Repository<CurrentInventory>().Update(currentInventory);

                adjustment.Items.Add(new AdjustmentItem
                {
                    MaterialId = resolvedItem.Request.MaterialId,
                    UnitId = resolvedItem.UnitId,
                    Quantity = resolvedItem.Request.Quantity,
                    ConversionRate = resolvedItem.ConversionRate
                });
            }

            adjustment.Reason = request.Reason;
            adjustment.Description = request.Description;
            adjustment.Status = InventoryAdjustmentStatus.Pending;
            adjustment.RejectedReason = null;
            adjustment.ApprovedBy = null;
            adjustment.ApprovedAt = null;

            if (linkedIncident != null)
            {
                linkedIncident.Status = IncidentStatus.UnderResolution;
                if (!string.IsNullOrWhiteSpace(request.Description))
                {
                    linkedIncident.HandlingInstruction = request.Description;
                }
                _unitOfWork.Repository<Incident>().Update(linkedIncident);
            }

            if (isResubmission)
            {
                var oldItems = adjustment.Items
                    .Where(item => item.AdjustmentItemId > 0)
                    .ToList();
                if (oldItems.Count > 0)
                {
                    _unitOfWork.Repository<AdjustmentItem>().RemoveRange(oldItems);
                    foreach (var oldItem in oldItems)
                    {
                        adjustment.Items.Remove(oldItem);
                    }
                }

                _unitOfWork.Repository<InventoryAdjustment>().Update(adjustment);
            }
            else
            {
                await _unitOfWork.Repository<InventoryAdjustment>().AddAsync(adjustment);
            }

            try
            {
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException exception) when (
                request.IncidentId.HasValue
                && IsIncidentAdjustmentUniqueViolation(exception))
            {
                throw new BusinessException(
                    "ERR_INCIDENT_ALREADY_ADJUSTED",
                    "Sự cố này đã có phiếu giảm tồn đang chờ duyệt.");
            }
            catch (DbUpdateConcurrencyException) when (request.IncidentId.HasValue)
            {
                throw new BusinessException(
                    "ERR_INCIDENT_STATE_CHANGED",
                    "Sự cố đã được xử lý bởi một phiên làm việc khác. Vui lòng tải lại dữ liệu.");
            }

            // Gửi thông báo DB đến Giám đốc để phê duyệt (trừ người tạo)
            var userId = _currentUserService.GetRequiredUserId();
            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Director,
                isResubmission
                    ? "Phiếu giảm tồn kho đã điều chỉnh, cần phê duyệt lại"
                    : "Phiếu điều chỉnh giảm tồn kho cần phê duyệt",
                isResubmission
                    ? $"Kế toán vừa điều chỉnh và gửi lại phiếu giảm tồn kho #{adjustment.AdjustmentId} tại dự án {project.Name}."
                    : $"Kế toán vừa tạo phiếu giảm tồn kho #{adjustment.AdjustmentId} tại dự án {project.Name} đang chờ Giám đốc phê duyệt.",
                BPG.Domain.Constants.NotificationType.Procurement,
                userId,
                $"/projects/{request.ProjectId}/workspace/inventoryadjustments",
                adjustment.AdjustmentId,
                cancellationToken
            );

            // Realtime: broadcast to all members currently viewing this project
            await _realtimeSender.SendToGroupAsync(
                HubMethodNames.GroupProject + request.ProjectId,
                isResubmission
                    ? HubMethodNames.InventoryAdjustmentUpdated
                    : HubMethodNames.InventoryAdjustmentCreated,
                adjustment.AdjustmentId,
                cancellationToken);

            // Realtime: broadcast to all members viewing global incidents (Project_0)
            await _realtimeSender.SendToGroupAsync(
                HubMethodNames.GroupProject + 0,
                isResubmission
                    ? HubMethodNames.InventoryAdjustmentUpdated
                    : HubMethodNames.InventoryAdjustmentCreated,
                adjustment.AdjustmentId,
                cancellationToken);

            return ApiResponse<long>.SuccessResult(
                adjustment.AdjustmentId,
                isResubmission
                    ? "Đã cập nhật và gửi lại phiếu giảm tồn, chờ phê duyệt"
                    : "Tạo phiếu điều chỉnh giảm tồn thành công, chờ phê duyệt");
        }

        private static bool IsIncidentAdjustmentUniqueViolation(DbUpdateException exception)
        {
            for (Exception? current = exception; current != null; current = current.InnerException)
            {
                var numberProperty = current.GetType().GetProperty("Number");
                if (numberProperty?.GetValue(current) is int number
                    && (number == 2601 || number == 2627)
                    && current.Message.Contains(
                        "IX_InventoryAdjustments_IncidentId",
                        StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }
    }
}
