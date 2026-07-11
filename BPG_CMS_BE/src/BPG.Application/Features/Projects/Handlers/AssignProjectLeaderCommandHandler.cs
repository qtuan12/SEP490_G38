using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Projects.Handlers;

public class AssignProjectLeaderCommandHandler : IRequestHandler<AssignProjectLeaderCommand, bool>
{
    private readonly IUnitOfWork _uow;
    private readonly BPG.Application.IServices.IRealtimeNotificationSender _notificationSender;
    private readonly INotificationService _notificationService;

    public AssignProjectLeaderCommandHandler(IUnitOfWork uow, BPG.Application.IServices.IRealtimeNotificationSender notificationSender, INotificationService notificationService)
    {
        _uow = uow;
        _notificationSender = notificationSender;
        _notificationService = notificationService;
    }

    public async Task<bool> Handle(AssignProjectLeaderCommand request, CancellationToken cancellationToken)
    {
        var members = await _uow.Repository<ProjectMember>()
            .FindAsync(m => m.ProjectId == request.ProjectId && !m.IsDeleted, cancellationToken);

        var newLeader = members.FirstOrDefault(m => m.UserId == request.UserId);
        if (newLeader == null)
            throw new NotFoundException("Thành viên không tồn tại trong dự án này.", request.UserId);

        bool wasLeader = newLeader.IsLeader;

        foreach (var member in members)
        {
            member.IsLeader = false;
        }

        if (!wasLeader)
        {
            newLeader.IsLeader = true;
        }

        _uow.Repository<ProjectMember>().UpdateRange(members);
        await _uow.SaveChangesAsync(cancellationToken);

        await _notificationSender.SendToGroupAsync($"Project_{request.ProjectId}", "ProjectLeaderUpdated", null!, cancellationToken);

        // Nếu gán leader mới (không phải hủy), gửi thông báo cá nhân cho người đó
        if (!wasLeader)
        {
            var project = await _uow.Repository<Project>().GetByIdAsync(request.ProjectId, cancellationToken);
            if (project != null)
            {
                await _notificationService.SendNotificationAsync(
                    request.UserId,
                    "Bạn được chỉ định làm Trưởng nhóm",
                    $"Bạn đã được chỉ định làm Trưởng nhóm của dự án \"{project.Name}\". Hãy kiểm tra danh sách công việc và thành viên của mình.",
                    BPG.Domain.Constants.NotificationType.System,
                    BPG.Domain.Constants.NotificationReferenceType.Project,
                    request.ProjectId,
                    cancellationToken);
            }
        }

        return true;
    }
}
