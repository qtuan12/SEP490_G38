using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace BPG.Application.Features.Projects.Handlers;

public class PauseProjectCommandHandler : IRequestHandler<PauseProjectCommand, bool>
{
    private readonly IUnitOfWork _uow;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotificationSender _realtimeSender;
    private readonly ICurrentUserService _currentUserService;

    public PauseProjectCommandHandler(IUnitOfWork uow, INotificationService notificationService, IRealtimeNotificationSender realtimeSender, ICurrentUserService currentUserService)
    {
        _uow = uow;
        _notificationService = notificationService;
        _realtimeSender = realtimeSender;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(PauseProjectCommand request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>().GetByIdAsync(request.ProjectId, cancellationToken);

        if (project == null)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.Status != ProjectStatus.InProgress)
            throw new BusinessException("ERR_PROJECT_PAUSE", $"Chỉ có thể tạm dừng dự án khi đang ở trạng thái Active. Trạng thái hiện tại: {project.Status}");

        var userId = _currentUserService.UserId;
        var userName = "Hệ thống";
        if (userId.HasValue)
        {
            var user = await _uow.Repository<User>().GetByIdAsync(userId.Value, cancellationToken);
            if (user != null)
            {
                userName = user.FullName;
            }
        }

        project.PauseReason = AppendStatusHistory(
            project.PauseReason,
            "pause",
            request.PauseReason ?? "Tạm dừng dự án",
            System.DateTime.UtcNow,
            userName);

        project.Status = ProjectStatus.Paused;
        project.PausedAt = System.DateTime.UtcNow;

        _uow.Repository<Project>().Update(project);
        await _uow.SaveChangesAsync(cancellationToken);

        // Notify all project members
        var projectMembers = await _uow.Repository<ProjectMember>()
            .Query()
            .Where(pm => pm.ProjectId == project.ProjectId)
            .ToListAsync(cancellationToken);

        foreach (var pm in projectMembers)
        {
            await _notificationService.SendNotificationAsync(
                pm.UserId,
                "🛑 Dự án đã tạm dừng thi công",
                $"Dự án {project.Name} đã chính thức chuyển sang trạng thái Tạm dừng thi công. Tất cả thao tác tạo lập, chỉnh sửa và phê duyệt đã bị khóa.",
                "ProjectPaused",
                $"/projects/{project.ProjectId}/workspace/incidents"
            );
        }

        // Notify Key Roles (Director, TechnicalManager, Accountant)
        await _notificationService.SendNotificationToRoleAsync(
            BPG.Domain.Constants.UserRole.Director,
            "🛑 Dự án đã tạm dừng thi công",
            $"Dự án {project.Name} đã được chuyển sang trạng thái Tạm dừng thi công.",
            "ProjectPaused",
            $"/projects/{project.ProjectId}/workspace/incidents"
        );
        await _notificationService.SendNotificationToRoleAsync(
            BPG.Domain.Constants.UserRole.TechnicalManager,
            "🛑 Dự án đã tạm dừng thi công",
            $"Dự án {project.Name} đã được chuyển sang trạng thái Tạm dừng thi công.",
            "ProjectPaused",
            $"/projects/{project.ProjectId}/workspace/incidents"
        );
        await _notificationService.SendNotificationToRoleAsync(
            BPG.Domain.Constants.UserRole.Accountant,
            "🛑 Dự án đã tạm dừng thi công",
            $"Dự án {project.Name} đã được chuyển sang trạng thái Tạm dừng thi công.",
            "ProjectPaused",
            $"/projects/{project.ProjectId}/workspace/incidents"
        );

        // Realtime: broadcast ProjectUpdated event
        await _realtimeSender.SendToGroupAsync(
            HubMethodNames.GroupProject + project.ProjectId,
            HubMethodNames.ProjectUpdated,
            project.ProjectId,
            cancellationToken);

        await _realtimeSender.SendToGroupAsync(
            HubMethodNames.GroupProject + 0,
            HubMethodNames.ProjectUpdated,
            project.ProjectId,
            cancellationToken);

        return true;
    }

    private string AppendStatusHistory(string? currentReason, string type, string? reason, System.DateTime timestamp, string userName)
    {
        System.Collections.Generic.List<StatusHistoryItem> historyList;
        if (!string.IsNullOrEmpty(currentReason) && currentReason.Trim().StartsWith("["))
        {
            try
            {
                historyList = System.Text.Json.JsonSerializer.Deserialize<System.Collections.Generic.List<StatusHistoryItem>>(currentReason) ?? new System.Collections.Generic.List<StatusHistoryItem>();
            }
            catch
            {
                historyList = new System.Collections.Generic.List<StatusHistoryItem>();
            }
        }
        else
        {
            historyList = new System.Collections.Generic.List<StatusHistoryItem>();
            if (!string.IsNullOrEmpty(currentReason))
            {
                historyList.Add(new StatusHistoryItem
                {
                    Type = "pause",
                    Reason = currentReason,
                    Timestamp = System.DateTime.UtcNow,
                    User = "Hệ thống"
                });
            }
        }

        historyList.Add(new StatusHistoryItem
        {
            Type = type,
            Reason = reason,
            Timestamp = timestamp,
            User = userName
        });

        return System.Text.Json.JsonSerializer.Serialize(historyList);
    }

    private class StatusHistoryItem
    {
        public string Type { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public System.DateTime Timestamp { get; set; }
        public string User { get; set; } = string.Empty;
    }
}
