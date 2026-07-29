using BPG.Application.Common.Authorization;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Projects.Queries;

public record GetMyProjectAccessQuery(long ProjectId)
    : IRequest<ProjectAccessDto>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.Project(ProjectId);
}

public sealed class ProjectAccessDto
{
    public long ProjectId { get; init; }
    public bool IsMember { get; init; }
    public bool IsLeader { get; init; }
    public IReadOnlyList<string> Permissions { get; init; } = [];
}

public sealed class GetMyProjectAccessQueryHandler
    : IRequestHandler<GetMyProjectAccessQuery, ProjectAccessDto>
{
    private readonly ICurrentUserService _currentUser;
    private readonly IPermissionService _permissionService;
    private readonly IUnitOfWork _unitOfWork;

    public GetMyProjectAccessQueryHandler(
        ICurrentUserService currentUser,
        IPermissionService permissionService,
        IUnitOfWork unitOfWork)
    {
        _currentUser = currentUser;
        _permissionService = permissionService;
        _unitOfWork = unitOfWork;
    }

    public async Task<ProjectAccessDto> Handle(
        GetMyProjectAccessQuery request,
        CancellationToken ct)
    {
        var userId = _currentUser.GetRequiredUserId();
        var member = await _unitOfWork.Repository<ProjectMember>()
            .Query()
            .AsNoTracking()
            .Where(item => item.ProjectId == request.ProjectId && item.UserId == userId)
            .Select(item => new { item.IsLeader })
            .FirstOrDefaultAsync(ct);

        return new ProjectAccessDto
        {
            ProjectId = request.ProjectId,
            IsMember = member != null,
            IsLeader = member?.IsLeader ?? false,
            Permissions = await _permissionService.GetProjectPermissionsAsync(request.ProjectId, ct)
        };
    }
}
