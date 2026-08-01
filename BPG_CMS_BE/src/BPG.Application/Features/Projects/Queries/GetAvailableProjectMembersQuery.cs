using AutoMapper;
using BPG.Application.DTOs.Users;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Roles = BPG.Domain.Constants.UserRole;

namespace BPG.Application.Features.Projects.Queries;

public sealed record GetAvailableProjectMembersQuery(long ProjectId)
    : IRequest<IReadOnlyList<UserDto>>;

public sealed class GetAvailableProjectMembersQueryHandler
    : IRequestHandler<GetAvailableProjectMembersQuery, IReadOnlyList<UserDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUser;
    private readonly IMapper _mapper;

    public GetAvailableProjectMembersQueryHandler(
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUser,
        IMapper mapper)
    {
        _unitOfWork = unitOfWork;
        _currentUser = currentUser;
        _mapper = mapper;
    }

    public async Task<IReadOnlyList<UserDto>> Handle(
        GetAvailableProjectMembersQuery request,
        CancellationToken ct)
    {
        var projectExists = await _unitOfWork.Repository<Project>()
            .AnyAsync(project => project.ProjectId == request.ProjectId, ct);
        if (!projectExists)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        if (!_currentUser.IsInRole(Roles.TechnicalManager))
        {
            var currentUserId = _currentUser.GetRequiredUserId();
            var isProjectLeader = await _unitOfWork.Repository<ProjectMember>().AnyAsync(
                member => member.ProjectId == request.ProjectId
                    && member.UserId == currentUserId
                    && member.IsLeader,
                ct);

            if (!isProjectLeader)
                throw new ForbiddenException("Chỉ Trưởng dự án mới được xem danh sách kỹ sư có thể thêm.");
        }

        var existingMemberIds = _unitOfWork.Repository<ProjectMember>()
            .Query()
            .AsNoTracking()
            .Where(member => member.ProjectId == request.ProjectId)
            .Select(member => member.UserId);

        var now = DateTime.UtcNow;
        var candidates = await _unitOfWork.Repository<User>()
            .Query()
            .AsNoTracking()
            .Include(user => user.UserRoles)
                .ThenInclude(userRole => userRole.Role)
            .Where(user => user.IsActive
                && (!user.LockedUntil.HasValue || user.LockedUntil <= now)
                && user.UserRoles.Any(userRole => userRole.Role.RoleName == Roles.SiteEngineer)
                && !existingMemberIds.Contains(user.UserId))
            .OrderBy(user => user.FullName)
            .ToListAsync(ct);

        return _mapper.Map<List<UserDto>>(candidates);
    }
}
