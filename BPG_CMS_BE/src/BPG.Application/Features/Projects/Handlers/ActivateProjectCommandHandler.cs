namespace BPG.Application.Features.Projects.Handlers;

using BPG.Domain.Exceptions;
using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

public class ActivateProjectCommandHandler : IRequestHandler<ActivateProjectCommand, MediatR.Unit>
{
    private readonly IUnitOfWork _uow;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotificationSender _realtimeSender;
    private readonly ICurrentUserService? _currentUserService;

    public ActivateProjectCommandHandler(
        IUnitOfWork uow,
        INotificationService notificationService,
        IRealtimeNotificationSender realtimeSender,
        ICurrentUserService? currentUserService = null)
    {
        _uow = uow;
        _notificationService = notificationService;
        _realtimeSender = realtimeSender;
        _currentUserService = currentUserService;
    }

    public async Task<MediatR.Unit> Handle(ActivateProjectCommand request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>().Query()
            .Include(p => p.Phases)
                .ThenInclude(ph => ph.Tasks)
            .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, cancellationToken);

        if (project == null)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.Status != ProjectStatus.Draft)
            throw new BusinessException("ERR_PROJECT_NOT_DRAFT", "Dự án phải ở trạng thái Bản Nháp để kích hoạt.");

        var hasAnyTask = project.Phases.Any(ph => ph.Tasks.Any());
        if (!hasAnyTask)
            throw new BusinessException("ERR_PROJECT_NO_TASKS", "Dự án phải có ít nhất một công việc để kích hoạt.");
        var currentUserId = _currentUserService?.UserId;
        var userName = "Hệ thống";
        if (currentUserId.HasValue)
        {
            var user = await _uow.Repository<User>().GetByIdAsync(currentUserId.Value, cancellationToken);
            if (user != null)
            {
                userName = user.FullName;
            }
        }

        project.PauseReason = AppendStatusHistory(
            project.PauseReason,
            "activate",
            "Kích hoạt bắt đầu thi công dự án",
            System.DateTime.UtcNow,
            userName);

        project.Status = ProjectStatus.InProgress;
        _uow.Repository<Project>().Update(project);
        await _uow.SaveChangesAsync(cancellationToken);

        // Fetch and notify all project members
        var projectMembers = await _uow.Repository<ProjectMember>()
            .Query()
            .Where(pm => pm.ProjectId == project.ProjectId)
            .ToListAsync(cancellationToken);

        foreach (var pm in projectMembers)
        {
            if (currentUserId.HasValue && pm.UserId == currentUserId.Value) continue;

            await _notificationService.SendNotificationAsync(
                pm.UserId,
                "🚀 Dự án đã được kích hoạt",
                $"Dự án {project.Name} đã chính thức được kích hoạt và bắt đầu thi công.",
                NotificationType.Progress,
                NotificationReferenceType.Project,
                project.ProjectId,
                cancellationToken
            );
        }

        // Notify Key Roles (Director, TechnicalManager, Accountant)
        if (currentUserId.HasValue)
        {
            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Director,
                "🚀 Dự án đã được kích hoạt",
                $"Dự án {project.Name} đã chính thức được kích hoạt và bắt đầu thi công.",
                NotificationType.Progress,
                currentUserId.Value,
                NotificationReferenceType.Project,
                project.ProjectId,
                cancellationToken
            );

            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.TechnicalManager,
                "🚀 Dự án đã được kích hoạt",
                $"Dự án {project.Name} đã chính thức được kích hoạt và bắt đầu thi công.",
                NotificationType.Progress,
                currentUserId.Value,
                NotificationReferenceType.Project,
                project.ProjectId,
                cancellationToken
            );

            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Accountant,
                "🚀 Dự án đã được kích hoạt",
                $"Dự án {project.Name} đã chính thức được kích hoạt và bắt đầu thi công.",
                NotificationType.Progress,
                currentUserId.Value,
                NotificationReferenceType.Project,
                project.ProjectId,
                cancellationToken
            );
        }
        else
        {
            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Director,
                "🚀 Dự án đã được kích hoạt",
                $"Dự án {project.Name} đã chính thức được kích hoạt và bắt đầu thi công.",
                NotificationType.Progress,
                NotificationReferenceType.Project,
                project.ProjectId,
                cancellationToken
            );

            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.TechnicalManager,
                "🚀 Dự án đã được kích hoạt",
                $"Dự án {project.Name} đã chính thức được kích hoạt và bắt đầu thi công.",
                NotificationType.Progress,
                NotificationReferenceType.Project,
                project.ProjectId,
                cancellationToken
            );

            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Accountant,
                "🚀 Dự án đã được kích hoạt",
                $"Dự án {project.Name} đã chính thức được kích hoạt và bắt đầu thi công.",
                NotificationType.Progress,
                NotificationReferenceType.Project,
                project.ProjectId,
                cancellationToken
            );
        }

        await _realtimeSender.SendToGroupAsync(
            HubMethodNames.GroupProject + project.ProjectId,
            HubMethodNames.ProjectUpdated,
            new { ProjectId = project.ProjectId, Status = project.Status },
            cancellationToken);

        await _realtimeSender.SendToGroupAsync(
            HubMethodNames.GroupProject + 0,
            HubMethodNames.ProjectUpdated,
            new { ProjectId = project.ProjectId, Status = project.Status },
            cancellationToken);

        return MediatR.Unit.Value;
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
