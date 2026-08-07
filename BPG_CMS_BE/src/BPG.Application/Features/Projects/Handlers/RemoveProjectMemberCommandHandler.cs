using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using Roles = BPG.Domain.Constants.UserRole;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Projects.Handlers;

public class RemoveProjectMemberCommandHandler : IRequestHandler<RemoveProjectMemberCommand, bool>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly IRealtimeNotificationSender _realtimeSender;

    public RemoveProjectMemberCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser, IRealtimeNotificationSender realtimeSender)
    {
        _uow = uow;
        _currentUser = currentUser;
        _realtimeSender = realtimeSender;
    }

    public async Task<bool> Handle(RemoveProjectMemberCommand request, CancellationToken cancellationToken)
    {
        if (_currentUser.IsInRole(Roles.SiteEngineer))
        {
            var currentUserId = _currentUser.GetRequiredUserId();
            var isLeader = await _uow.Repository<ProjectMember>().AnyAsync(
                candidate => candidate.ProjectId == request.ProjectId
                    && candidate.UserId == currentUserId
                    && candidate.IsLeader,
                cancellationToken);
            if (!isLeader)
                throw new ForbiddenException("Chỉ Trưởng dự án mới được xóa thành viên khỏi dự án này.");

            var targetIsSiteEngineer = await _uow.Repository<ProjectMember>().Query()
                .Where(candidate => candidate.ProjectId == request.ProjectId && candidate.UserId == request.UserId)
                .SelectMany(candidate => candidate.User.UserRoles)
                .AnyAsync(userRole => userRole.Role.RoleName == Roles.SiteEngineer, cancellationToken);
            if (!targetIsSiteEngineer)
                throw new ForbiddenException("Trưởng dự án chỉ được xóa Site Engineer khỏi dự án.");
        }

        var member = await _uow.Repository<ProjectMember>()
            .FirstOrDefaultAsync(m => m.ProjectId == request.ProjectId && m.UserId == request.UserId, cancellationToken);

        if (member == null || member.IsDeleted)
            throw new NotFoundException(nameof(ProjectMember), request.UserId);

        member.IsDeleted = true;
        _uow.Repository<ProjectMember>().Update(member);

        await _uow.SaveChangesAsync(cancellationToken);

        await _realtimeSender.SendToGroupAsync(
            $"Project_{request.ProjectId}",
            "ProjectMemberRemoved",
            new { request.ProjectId, request.UserId },
            cancellationToken);

        return true;
    }
}
