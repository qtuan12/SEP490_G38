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

    public CreateSurplusRequestCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser, INotificationService notificationService)
    {
        _uow = uow;
        _currentUser = currentUser;
        _notificationService = notificationService;
    }

    public async Task<ApiResponse<long>> Handle(CreateSurplusRequestCommand request, CancellationToken ct)
    {
        var userId = _currentUser.GetRequiredUserId();

        var project = await _uow.Repository<Project>().Query()
            .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, ct)
            ?? throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.Status != ProjectStatus.InProgress)
            throw new BusinessException(ErrorCodes.InvalidTransition, "Dự án phải đang hoạt động để tạo đề xuất xử lý vật tư thừa.");

        // Verify caller is Leader of this project
        var isLeader = await _uow.Repository<ProjectMember>().Query()
            .AnyAsync(m => m.ProjectId == request.ProjectId && m.UserId == userId && m.IsLeader, ct);
        if (!isLeader)
            throw new BusinessException(ErrorCodes.Forbidden, "Chỉ Project Leader mới được tạo đề xuất xử lý vật tư thừa.");

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

        await _notificationService.SendNotificationToRoleAsync(
            Domain.Constants.UserRole.Accountant,
            "Yêu cầu xử lý vật tư thừa mới",
            string.Format(NotificationTemplates.SurplusRequestSubmitted, batch.SurplusRequestId, project.Name),
            NotificationType.Procurement,
            NotificationReferenceType.SurplusRequest,
            batch.SurplusRequestId,
            ct);

        return ApiResponse<long>.SuccessResult(batch.SurplusRequestId, ResponseMessages.CreateSuccess);
    }
}
