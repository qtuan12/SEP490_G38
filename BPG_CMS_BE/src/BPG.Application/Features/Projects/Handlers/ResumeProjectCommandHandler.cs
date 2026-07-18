using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Projects.Handlers;

public class ResumeProjectCommandHandler : IRequestHandler<ResumeProjectCommand, bool>
{
    private readonly IUnitOfWork _uow;
    private readonly INotificationService _notificationService;

    public ResumeProjectCommandHandler(IUnitOfWork uow, INotificationService notificationService)
    {
        _uow = uow;
        _notificationService = notificationService;
    }

    public async Task<bool> Handle(ResumeProjectCommand request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>().GetByIdAsync(request.ProjectId, cancellationToken);

        if (project == null)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.Status != ProjectStatus.Paused)
            throw new BusinessException("ERR_PROJECT_RESUME", $"Chỉ có thể tiếp tục dự án khi đang ở trạng thái Paused. Trạng thái hiện tại: {project.Status}");

        project.Status = ProjectStatus.InProgress;
        project.ResumedAt = System.DateTime.UtcNow;

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
                "Dự án đã được kích hoạt lại",
                $"Dự án {project.Name} đã chính thức được kích hoạt lại và tiếp tục thi công.",
                "ProjectResumed",
                $"/projects/{project.ProjectId}/workspace/incidents"
            );
        }

        // Notify Director as well
        await _notificationService.SendNotificationToRoleAsync(
            BPG.Domain.Constants.UserRole.Director,
            "Dự án đã được kích hoạt lại",
            $"Dự án {project.Name} đã chính thức được kích hoạt lại và tiếp tục thi công.",
            "ProjectResumed",
            $"/projects/{project.ProjectId}/workspace/incidents"
        );

        return true;
    }
}
