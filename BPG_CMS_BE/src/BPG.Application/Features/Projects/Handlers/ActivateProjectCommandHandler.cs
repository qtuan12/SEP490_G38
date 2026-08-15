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

    public ActivateProjectCommandHandler(
        IUnitOfWork uow,
        INotificationService notificationService,
        IRealtimeNotificationSender realtimeSender)
    {
        _uow = uow;
        _notificationService = notificationService;
        _realtimeSender = realtimeSender;
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
            throw new BusinessException("ERR_PROJECT_NO_TASKS", "Không thể kích hoạt dự án vì dự án chưa có công việc nào.");

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
}
