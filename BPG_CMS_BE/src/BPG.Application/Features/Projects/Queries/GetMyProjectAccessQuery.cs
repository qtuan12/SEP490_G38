using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Projects.Queries;

public record GetMyProjectAccessQuery(long ProjectId)
    : IRequest<ProjectAccessDto>;

public sealed class ProjectAccessDto
{
    public long ProjectId { get; init; }
    public bool IsMember { get; init; }
    public bool IsLeader { get; init; }
}

public sealed class GetMyProjectAccessQueryHandler
    : IRequestHandler<GetMyProjectAccessQuery, ProjectAccessDto>
{
    private readonly ICurrentUserService _currentUser;
    private readonly IUnitOfWork _unitOfWork;

    public GetMyProjectAccessQueryHandler(
        ICurrentUserService currentUser,
        IUnitOfWork unitOfWork)
    {
        _currentUser = currentUser;
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
            IsLeader = member?.IsLeader ?? false
        };
    }
}
