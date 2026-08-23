namespace BPG.Application.Features.Projects.Handlers;

using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

public class CompleteProjectCommandHandler : IRequestHandler<CompleteProjectCommand, MediatR.Unit>
{
    private readonly IUnitOfWork _uow;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotificationSender _realtimeSender;
    private readonly ICurrentUserService _currentUserService;

    public CompleteProjectCommandHandler(
        IUnitOfWork uow,
        INotificationService notificationService,
        IRealtimeNotificationSender realtimeSender,
        ICurrentUserService currentUserService)
    {
        _uow = uow;
        _notificationService = notificationService;
        _realtimeSender = realtimeSender;
        _currentUserService = currentUserService;
    }

    public async Task<MediatR.Unit> Handle(CompleteProjectCommand request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>()
            .Query()
            .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, cancellationToken);

        if (project == null)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.Status != ProjectStatus.InProgress)
            throw new BusinessException("ERR_PROJECT_NOT_INPROGRESS", $"Chỉ có thể hoàn thành dự án khi đang ở trạng thái Đang chạy (InProgress). Trạng thái hiện tại: {project.Status}");

        // Check if all non-obsolete tasks in the project are 100% completed
        var uncompletedTasks = await _uow.Repository<ProjectTask>()
            .Query()
            .Include(t => t.Phase)
            .Where(t => t.Phase.ProjectId == request.ProjectId
                        && t.Status != BPG.Domain.Constants.TaskStatus.Obsolete
                        && t.ProgressPercent < 100)
            .ToListAsync(cancellationToken);

        if (uncompletedTasks.Any())
        {
            throw new BusinessException("ERR_PROJECT_TASKS_NOT_COMPLETED", $"Dự án còn {uncompletedTasks.Count} công việc chưa hoàn thành 100%. Vui lòng hoàn tất toàn bộ công việc trước khi hoàn thành dự án.");
        }

        // Check if there are any pending/unresolved incidents
        var pendingIncidents = await _uow.Repository<Incident>()
            .Query()
            .Where(i => i.ProjectId == request.ProjectId &&
                        (i.Status == "WaitingReview" ||
                         i.Status == "WaitingStopApproval" ||
                         i.Status == "WaitingRecoveryPlan" ||
                         i.Status == "WaitingDirectorApproval" ||
                         i.Status == IncidentStatus.WaitingAccountant ||
                         i.Status == IncidentStatus.UnderResolution ||
                         i.Status == "Assessing"))
            .ToListAsync(cancellationToken);

        if (pendingIncidents.Any())
        {
            throw new BusinessException("ERR_PENDING_INCIDENTS", $"Dự án còn {pendingIncidents.Count} sự cố chưa được xử lý/phê duyệt. Vui lòng giải quyết toàn bộ sự cố trước khi hoàn thành dự án.");
        }

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
            "complete",
            "Hoàn thành dự án",
            System.DateTime.UtcNow,
            userName);

        project.Status = ProjectStatus.Completed;
        _uow.Repository<Project>().Update(project);
        await _uow.SaveChangesAsync(cancellationToken);

        // Fetch and notify all project members
        var projectMembers = await _uow.Repository<ProjectMember>()
            .Query()
            .Where(pm => pm.ProjectId == project.ProjectId)
            .ToListAsync(cancellationToken);

        foreach (var pm in projectMembers)
        {
            if (userId.HasValue && pm.UserId == userId.Value) continue;

            await _notificationService.SendNotificationAsync(
                pm.UserId,
                "🎉 Dự án đã hoàn thành",
                $"Dự án {project.Name} đã được xác nhận hoàn thành bởi {userName}.",
                NotificationType.Progress,
                NotificationReferenceType.Project,
                project.ProjectId,
                cancellationToken
            );
        }

        // Notify Key Roles (Director, TechnicalManager, Accountant)
        if (userId.HasValue)
        {
            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Director,
                "🎉 Dự án đã hoàn thành",
                $"Dự án {project.Name} đã được xác nhận hoàn thành bởi {userName}.",
                NotificationType.Progress,
                userId.Value,
                NotificationReferenceType.Project,
                project.ProjectId,
                cancellationToken
            );

            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.TechnicalManager,
                "🎉 Dự án đã hoàn thành",
                $"Dự án {project.Name} đã được xác nhận hoàn thành bởi {userName}.",
                NotificationType.Progress,
                userId.Value,
                NotificationReferenceType.Project,
                project.ProjectId,
                cancellationToken
            );

            await _notificationService.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Accountant,
                "🎉 Dự án đã hoàn thành",
                $"Dự án {project.Name} đã được xác nhận hoàn thành bởi {userName}.",
                NotificationType.Progress,
                userId.Value,
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
        List<StatusHistoryItem> historyList;
        if (!string.IsNullOrEmpty(currentReason) && currentReason.Trim().StartsWith("["))
        {
            try
            {
                historyList = JsonSerializer.Deserialize<List<StatusHistoryItem>>(currentReason) ?? new List<StatusHistoryItem>();
            }
            catch
            {
                historyList = new List<StatusHistoryItem>();
            }
        }
        else
        {
            historyList = new List<StatusHistoryItem>();
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

        return JsonSerializer.Serialize(historyList);
    }

    private class StatusHistoryItem
    {
        public string Type { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public System.DateTime Timestamp { get; set; }
        public string User { get; set; } = string.Empty;
    }
}
