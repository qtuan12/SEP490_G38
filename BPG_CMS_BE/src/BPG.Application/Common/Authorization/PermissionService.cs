using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Common.Authorization;

public sealed class PermissionService : IPermissionService
{
    private readonly ICurrentUserService _currentUser;
    private readonly IUnitOfWork _unitOfWork;

    public PermissionService(ICurrentUserService currentUser, IUnitOfWork unitOfWork)
    {
        _currentUser = currentUser;
        _unitOfWork = unitOfWork;
    }

    public bool HasSystemPermission(string permission) =>
        GetSystemPermissions().Contains(permission, StringComparer.OrdinalIgnoreCase);

    public IReadOnlyList<string> GetSystemPermissions()
    {
        if (!_currentUser.IsAuthenticated)
            return [];

        return PermissionGrantCatalog.GetSystemPermissions(_currentUser.Roles)
            .OrderBy(permission => permission, StringComparer.Ordinal)
            .ToList();
    }

    public async Task<bool> HasProjectPermissionAsync(
        long projectId,
        string permission,
        CancellationToken ct = default)
    {
        var permissions = await GetProjectPermissionsAsync(projectId, ct);
        return permissions.Contains(permission, StringComparer.OrdinalIgnoreCase);
    }

    public async Task<IReadOnlyList<string>> GetProjectPermissionsAsync(
        long projectId,
        CancellationToken ct = default)
    {
        if (!_currentUser.IsAuthenticated)
            throw new UnauthorizedException();

        bool? isLeader = null;

        if (projectId > 0)
        {
            var userId = _currentUser.GetRequiredUserId();
            isLeader = await _unitOfWork.Repository<ProjectMember>()
                .Query()
                .AsNoTracking()
                .Where(item => item.ProjectId == projectId && item.UserId == userId)
                .Select(item => (bool?)item.IsLeader)
                .FirstOrDefaultAsync(ct);
        }

        return PermissionGrantCatalog.GetProjectPermissions(
                _currentUser.Roles,
                isLeader)
            .OrderBy(permission => permission, StringComparer.Ordinal)
            .ToList();
    }

    public async Task<IReadOnlySet<long>> GetProjectIdsWithPermissionAsync(
        string permission,
        CancellationToken ct = default)
    {
        if (!_currentUser.IsAuthenticated)
            throw new UnauthorizedException();

        var projectIds = await _unitOfWork.Repository<Project>()
            .Query()
            .AsNoTracking()
            .Select(project => project.ProjectId)
            .ToListAsync(ct);

        if (_currentUser.Roles.Contains(
                BPG.Domain.Constants.UserRole.Admin,
                StringComparer.OrdinalIgnoreCase))
            return projectIds.ToHashSet();

        var userId = _currentUser.GetRequiredUserId();
        var memberships = await _unitOfWork.Repository<ProjectMember>()
            .Query()
            .AsNoTracking()
            .Where(item => item.UserId == userId)
            .Select(item => new { item.ProjectId, item.IsLeader })
            .ToListAsync(ct);

        var membershipsByProject = memberships.ToDictionary(
            item => item.ProjectId,
            item => item.IsLeader);

        var accessibleProjectIds = new HashSet<long>();
        foreach (var projectId in projectIds)
        {
            bool? isLeader = membershipsByProject.TryGetValue(projectId, out var leader)
                ? leader
                : null;

            var effectivePermissions = PermissionGrantCatalog.GetProjectPermissions(
                _currentUser.Roles,
                isLeader);

            if (effectivePermissions.Contains(permission, StringComparer.OrdinalIgnoreCase))
                accessibleProjectIds.Add(projectId);
        }

        return accessibleProjectIds;
    }
}
