using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Common.Authorization;

public sealed class ProjectAccessService : IProjectAccessService
{
    private readonly ICurrentUserService _currentUser;
    private readonly IUnitOfWork _unitOfWork;

    public ProjectAccessService(ICurrentUserService currentUser, IUnitOfWork unitOfWork)
    {
        _currentUser = currentUser;
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlySet<long>> GetAccessibleProjectIdsAsync(CancellationToken ct = default)
    {
        if (!_currentUser.IsAuthenticated)
            throw new UnauthorizedException();

        if (_currentUser.IsInAnyRole(
                BPG.Domain.Constants.UserRole.Director,
                BPG.Domain.Constants.UserRole.TechnicalManager,
                BPG.Domain.Constants.UserRole.Accountant))
        {
            var allProjectIds = await _unitOfWork.Repository<Project>()
                .Query()
                .AsNoTracking()
                .Select(project => project.ProjectId)
                .ToListAsync(ct);

            return allProjectIds.ToHashSet();
        }

        var userId = _currentUser.GetRequiredUserId();
        var memberProjectIds = await _unitOfWork.Repository<ProjectMember>()
            .Query()
            .AsNoTracking()
            .Where(member => member.UserId == userId)
            .Select(member => member.ProjectId)
            .ToListAsync(ct);

        return memberProjectIds.ToHashSet();
    }

    public async Task<bool> IsCurrentUserProjectMemberAsync(long projectId, CancellationToken ct = default)
    {
        var userId = _currentUser.GetRequiredUserId();
        return await _unitOfWork.Repository<ProjectMember>()
            .AnyAsync(member => member.ProjectId == projectId && member.UserId == userId, ct);
    }

    public async Task<bool> IsCurrentUserProjectLeaderAsync(long projectId, CancellationToken ct = default)
    {
        var userId = _currentUser.GetRequiredUserId();
        return await _unitOfWork.Repository<ProjectMember>()
            .AnyAsync(
                member => member.ProjectId == projectId
                    && member.UserId == userId
                    && member.IsLeader,
                ct);
    }
}

