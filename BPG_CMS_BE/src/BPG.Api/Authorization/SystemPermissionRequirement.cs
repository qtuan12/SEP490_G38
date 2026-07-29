using BPG.Application.IServices;
using Microsoft.AspNetCore.Authorization;

namespace BPG.Api.Authorization;

public sealed record SystemPermissionRequirement(string Permission) : IAuthorizationRequirement;

public sealed class SystemPermissionHandler : AuthorizationHandler<SystemPermissionRequirement>
{
    private readonly IPermissionService _permissionService;

    public SystemPermissionHandler(IPermissionService permissionService)
    {
        _permissionService = permissionService;
    }

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        SystemPermissionRequirement requirement)
    {
        if (_permissionService.HasSystemPermission(requirement.Permission))
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
