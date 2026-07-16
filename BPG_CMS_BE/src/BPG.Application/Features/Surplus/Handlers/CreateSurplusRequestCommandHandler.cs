using BPG.Application.Common.Models;
using BPG.Application.Features.Surplus.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Surplus.Handlers;

/// <summary>
/// Business rule:
/// - Dự án phải Active.
/// - Không được tạo batch mới khi đã có batch đang Processing.
/// - Batch auto chứa TOÀN BỘ tồn kho > 0 của dự án.
/// - Leader (IsLeader = true trong ProjectMember) mới được tạo.
/// </summary>
public class CreateSurplusRequestCommandHandler : IRequestHandler<CreateSurplusRequestCommand, ApiResponse<long>>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotificationSender _realtimeSender;

    public CreateSurplusRequestCommandHandler(
        IUnitOfWork uow,
        ICurrentUserService currentUser,
        INotificationService notificationService,
        IRealtimeNotificationSender realtimeSender)
    {
        _uow = uow;
        _currentUser = currentUser;
        _notificationService = notificationService;
        _realtimeSender = realtimeSender;
    }

    public async Task<ApiResponse<long>> Handle(CreateSurplusRequestCommand request, CancellationToken ct)
    {
        var userId = _currentUser.GetRequiredUserId();

        var project = await _uow.Repository<Project>().Query()
            .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, ct)
            ?? throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.Status != ProjectStatus.InProgress)
            throw new BusinessException(ErrorCodes.InvalidTransition, "Dự án phải đang hoạt động để tạo đề xuất xử lý vật tư thừa.");

        // Verify caller is Leader of this project or higher role
        var isLeader = await _uow.Repository<ProjectMember>().Query()
            .AnyAsync(m => m.ProjectId == request.ProjectId && m.UserId == userId && m.IsLeader, ct);
        var isManagerOrAdmin = _currentUser.IsInAnyRole(Domain.Constants.UserRole.TechnicalManager, Domain.Constants.UserRole.Admin);
        
        if (!isLeader && !isManagerOrAdmin)
            throw new BusinessException(ErrorCodes.Forbidden, "Chỉ Project Leader hoặc Trưởng phòng kỹ thuật mới được tạo đề xuất xử lý vật tư thừa.");

        // No active batch allowed
        var hasActiveBatch = await _uow.Repository<SurplusRequest>().Query()
            .AnyAsync(sr => sr.ProjectId == request.ProjectId && sr.Status == SurplusRequestStatus.Processing, ct);
        if (hasActiveBatch)
            throw new BusinessException(ErrorCodes.DuplicateEntry, "Dự án đang có batch xử lý vật tư thừa chưa hoàn tất.");

        // Pull all inventory with quantity > 0
        var inventoryItems = await _uow.Repository<CurrentInventory>().Query()
            .Where(ci => ci.ProjectId == request.ProjectId && ci.Quantity > 0)
            .AsNoTracking()
            .ToListAsync(ct);

        if (!inventoryItems.Any())
            throw new BusinessException(ErrorCodes.NotFound, "Không có vật tư nào trong kho để tạo đề xuất xử lý.");

        var batch = new SurplusRequest
        {
            ProjectId = request.ProjectId,
            Reason = request.Reason,
            Status = SurplusRequestStatus.Processing,
            Items = inventoryItems.Select(ci => new SurplusRequestItem
            {
                MaterialId = ci.MaterialId,
                UnitId = ci.UnitId,
                Quantity = ci.Quantity,
                ProcessedQuantity = 0,
                ConversionRate = 1,
                Status = SurplusRequestItemStatus.Pending
            }).ToList()
        };

        await _uow.Repository<SurplusRequest>().AddAsync(batch, ct);
        await _uow.SaveChangesAsync(ct);

        var creator = await _uow.Repository<User>().Query()
            .FirstOrDefaultAsync(u => u.UserId == userId, ct);
        var creatorName = creator?.FullName ?? "Ai đó";

        var notiTitle = "Yêu cầu xử lý vật tư thừa mới";
        var notiContent = $"[{creatorName}] đã tạo phiếu xử lý vật tư thừa (Mã: {batch.SurplusRequestId}) cho dự án [{project.Name}].";

        // 1. Luôn thông báo đến Kế toán (trừ người tạo)
        await _notificationService.SendNotificationToRoleAsync(
            Domain.Constants.UserRole.Accountant,
            notiTitle,
            notiContent,
            NotificationType.Procurement,
            excludeUserId: userId,
            NotificationReferenceType.SurplusRequest,
            batch.SurplusRequestId,
            ct);

        // 2. Nếu do TechnicalManager/Admin tạo -> Thông báo đến Project Leader (trừ người tạo)
        if (isManagerOrAdmin)
        {
            var projectLeaderId = await _uow.Repository<ProjectMember>().Query()
                .Where(m => m.ProjectId == request.ProjectId && m.IsLeader && m.UserId != userId)
                .Select(m => m.UserId)
                .FirstOrDefaultAsync(ct);

            if (projectLeaderId > 0)
            {
                await _notificationService.SendNotificationAsync(
                    projectLeaderId,
                    notiTitle,
                    notiContent,
                    NotificationType.Procurement,
                    NotificationReferenceType.SurplusRequest,
                    batch.SurplusRequestId,
                    ct);
            }
        }

        // 3. Nếu do Project Leader tạo -> Thông báo đến Trưởng phòng kỹ thuật (trừ người tạo)
        if (isLeader)
        {
            await _notificationService.SendNotificationToRoleAsync(
                Domain.Constants.UserRole.TechnicalManager,
                notiTitle,
                notiContent,
                NotificationType.Procurement,
                excludeUserId: userId,
                NotificationReferenceType.SurplusRequest,
                batch.SurplusRequestId,
                ct);
        }

        // Broadcast real-time SurplusUpdated to ALL project members (kể cả SiteEngineer thường)
        await _realtimeSender.SendToGroupAsync(
            $"Project_{request.ProjectId}",
            "SurplusUpdated",
            new { projectId = request.ProjectId, surplusRequestId = batch.SurplusRequestId },
            ct);

        return ApiResponse<long>.SuccessResult(batch.SurplusRequestId, ResponseMessages.CreateSuccess);
    }
}
