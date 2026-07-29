using BPG.Application.Common.Authorization;
using BPG.Application.Common.Interfaces;
using BPG.Application.IServices;
using BPG.Application.IRepositories;
using BPG.Domain.Exceptions;
using MediatR;

namespace BPG.Application.Common.Behaviors;

/// <summary>
/// Resolves the request's project resource and enforces its declared permission.
/// IProjectRequirement remains as a compatibility adapter for older queries.
/// </summary>
public class ProjectAuthorizationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ICurrentUserService _currentUserService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPermissionService _permissionService;
    private readonly IProjectResourceResolver _resourceResolver;

    public ProjectAuthorizationBehavior(
        ICurrentUserService currentUserService,
        IUnitOfWork unitOfWork,
        IPermissionService permissionService,
        IProjectResourceResolver resourceResolver)
    {
        _currentUserService = currentUserService;
        _unitOfWork = unitOfWork;
        _permissionService = permissionService;
        _resourceResolver = resourceResolver;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        long? projectId = null;
        string? permission = null;

        if (request is IProjectResourceRequirement resourceRequest)
        {
            projectId = await _resourceResolver.ResolveProjectIdAsync(
                resourceRequest.ProjectResource,
                cancellationToken);
            permission = resourceRequest.RequiredPermission;
        }
        else if (request is IProjectScopedListRequest scopedListRequest)
        {
            projectId = await scopedListRequest.GetProjectIdAsync(
                _unitOfWork,
                cancellationToken);
            permission = scopedListRequest.RequiredPermission;
        }
        else if (request is IProjectRequirement projectRequest)
        {
            projectId = await projectRequest.GetProjectIdAsync(_unitOfWork, cancellationToken);
            permission = projectRequest.RequiredPermission;
        }

        if (projectId is > 0)
        {
            var currentUserId = _currentUserService.UserId;
            if (currentUserId == null)
                throw new UnauthorizedException();

            var isAllowed = await _permissionService.HasProjectPermissionAsync(
                projectId.Value,
                permission!,
                cancellationToken);

            if (!isAllowed)
                throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này trong dự án.");
        }

        return await next();
    }
}
