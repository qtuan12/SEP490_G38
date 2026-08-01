using AutoMapper;
using BPG.Application.Features.Projects.Commands;
using BPG.Application.Features.Projects.DTOs;
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

public class AddProjectMemberCommandHandler : IRequestHandler<AddProjectMemberCommand, ProjectMemberDto>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;
    private readonly IRealtimeNotificationSender _realtimeSender;
    private readonly INotificationService _notificationService;
    private readonly ICurrentUserService _currentUser;

    public AddProjectMemberCommandHandler(IUnitOfWork uow, IMapper mapper, IRealtimeNotificationSender realtimeSender, INotificationService notificationService, ICurrentUserService currentUser)
    {
        _uow = uow;
        _mapper = mapper;
        _realtimeSender = realtimeSender;
        _notificationService = notificationService;
        _currentUser = currentUser;
    }

    public async Task<ProjectMemberDto> Handle(AddProjectMemberCommand request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>().GetByIdAsync(request.ProjectId, cancellationToken);
        if (project == null)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        if (!_currentUser.IsInRole(Roles.TechnicalManager))
        {
            var currentUserId = _currentUser.GetRequiredUserId();
            var isLeader = await _uow.Repository<ProjectMember>().AnyAsync(
                member => member.ProjectId == request.ProjectId && member.UserId == currentUserId && member.IsLeader,
                cancellationToken);
            if (!isLeader)
                throw new ForbiddenException("Chỉ Trưởng dự án mới được thêm thành viên vào dự án này.");
        }

        var user = await _uow.Repository<User>().Query()
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.UserId == request.UserId, cancellationToken);

        if (user == null)
            throw new NotFoundException(nameof(User), request.UserId);

        if (!user.IsActive || (user.LockedUntil.HasValue && user.LockedUntil > System.DateTime.UtcNow))
            throw new ForbiddenException("Không thể thêm tài khoản đang bị khóa vào dự án.");

        if (!user.UserRoles.Any(userRole => userRole.Role.RoleName == Roles.SiteEngineer))
            throw new ForbiddenException("Chỉ được thêm Site Engineer vào dự án.");

        var existingMember = await _uow.Repository<ProjectMember>().Query()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(m => m.ProjectId == request.ProjectId && m.UserId == request.UserId, cancellationToken);

        if (existingMember != null && !existingMember.IsDeleted)
            throw new BusinessException("ERR_PROJECT_MEMBER_ADD", "User is already a member of this project.");

        ProjectMember savedMember;
        if (existingMember != null && existingMember.IsDeleted)
        {
            existingMember.IsDeleted = false;
            existingMember.JoinedAt = System.DateTime.UtcNow;
            existingMember.User = user;
            _uow.Repository<ProjectMember>().Update(existingMember);
            savedMember = existingMember;
        }
        else
        {
            savedMember = new ProjectMember
            {
                ProjectId = request.ProjectId,
                UserId = request.UserId,
                IsLeader = false,
                JoinedAt = System.DateTime.UtcNow,
                User = user
            };

            await _uow.Repository<ProjectMember>().AddAsync(savedMember, cancellationToken);
        }

        await _uow.SaveChangesAsync(cancellationToken);

        var dto = _mapper.Map<ProjectMemberDto>(savedMember);

        // Realtime: broadcast to all members currently viewing this project
        await _realtimeSender.SendToGroupAsync(
            $"Project_{request.ProjectId}",
            "ProjectMemberAdded",
            null!,
            cancellationToken);

        // Personal notification to the newly added engineer
        await _notificationService.SendNotificationAsync(
            request.UserId,
            "Bạn đã được thêm vào dự án",
            $"Bạn đã được thêm vào dự án \"{project.Name}\". Hãy vào kiểm tra kế hoạch công việc của mình.",
            BPG.Domain.Constants.NotificationType.System,
            BPG.Domain.Constants.NotificationReferenceType.Project,
            request.ProjectId,
            cancellationToken);

        return dto;
    }
}
