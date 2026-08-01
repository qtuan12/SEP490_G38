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

            var userId = _currentUserService.GetRequiredUserId();
            if (_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.SiteEngineer))
            {
                var isProjectLeader = await _unitOfWork.Repository<ProjectMember>().AnyAsync(
                    member => member.ProjectId == request.ProjectId && member.UserId == userId && member.IsLeader,
                    cancellationToken);
                if (!isProjectLeader)
                    throw new ForbiddenException("Chỉ Site Engineer là Trưởng dự án mới được tạo phiếu tăng tồn.");
            }
            var phase = await _unitOfWork.Repository<Phase>().GetByIdAsync(request.PhaseId);
            if (phase == null)
            {
                throw new NotFoundException(nameof(Phase), request.PhaseId);
            }
            if (phase.ProjectId != request.ProjectId)
            {
                throw new BusinessException(ErrorCodes.InvalidTransition, "Giai đoạn không thuộc dự án này.");
            }

            var adjustment = new InventoryAdjustment
            {
                ProjectId = request.ProjectId,
                PhaseId = request.PhaseId,
                AdjustmentType = InventoryAdjustmentType.Increase,
                Reason = request.Reason,
                Description = request.Description,
                Status = InventoryAdjustmentStatus.Approved, // Auto approved
                ApprovedBy = _currentUserService.GetRequiredUserId(), // Auto approved by creator
                ApprovedAt = System.DateTime.UtcNow
            };

            var transactionsToUpdate = new List<InventoryTransaction>();

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

                adjustment.Items.Add(new AdjustmentItem
                {
                    MaterialId = item.MaterialId,
                    UnitId = material.BaseUnitId,
                    Quantity = item.Quantity,
                    ConversionRate = 1
                });

                // Tăng tồn kho
                var currentInventory = await _unitOfWork.Repository<CurrentInventory>()
                    .FirstOrDefaultAsync(x => x.ProjectId == request.ProjectId && x.MaterialId == item.MaterialId, cancellationToken);
                
                if (currentInventory == null)
                {
                    currentInventory = new CurrentInventory
                    {
                        ProjectId = request.ProjectId,
                        MaterialId = item.MaterialId,
                        UnitId = material.BaseUnitId,
                        Quantity = item.Quantity,
                        LastUpdated = System.DateTime.UtcNow
                    };
                    await _unitOfWork.Repository<CurrentInventory>().AddAsync(currentInventory);
                }
                else
                {
                    currentInventory.Quantity += item.Quantity;
                    currentInventory.LastUpdated = System.DateTime.UtcNow;
                    _unitOfWork.Repository<CurrentInventory>().Update(currentInventory);
                }

                // Ghi nhận thẻ kho (InventoryTransaction)
                var transaction = new InventoryTransaction
                {
                    ProjectId = request.ProjectId,
                    MaterialId = item.MaterialId,
                    TransactionType = InventoryTransactionType.Adjustment,
                    QuantityChange = item.Quantity, // Dương cho tăng
                    BalanceAfter = currentInventory.Quantity,
                    ReferenceType = EntityType.InventoryAdjustment,
                    CreatedBy = userId,
                    CreatedAt = System.DateTime.UtcNow
                    // ReferenceId sẽ được update sau khi save adjustment, ta sẽ save adjustment trước
                };
                await _unitOfWork.Repository<InventoryTransaction>().AddAsync(transaction);
                transactionsToUpdate.Add(transaction);
            }

            await _unitOfWork.Repository<InventoryAdjustment>().AddAsync(adjustment);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            // Cập nhật ReferenceId cho các transactions
            foreach (var trans in transactionsToUpdate)
            {
                trans.ReferenceId = adjustment.AdjustmentId;
                _unitOfWork.Repository<InventoryTransaction>().Update(trans);
            }
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Accountant,
                "Phiếu điều chỉnh tăng tồn đã được tạo",
                $"Một phiếu tăng tồn kho mới (#{adjustment.AdjustmentId}) đã được tạo và tự động phê duyệt. Tồn kho dự án đã được cập nhật.",
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

            return ApiResponse<long>.SuccessResult(adjustment.AdjustmentId, "Tạo phiếu điều chỉnh tăng tồn thành công (đã tự động phê duyệt)");
        }
    }
}
