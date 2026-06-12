using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace BPG.Api.Middleware;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class AuthorizeRolesAttribute : AuthorizeAttribute, IAuthorizationFilter
{
    private readonly string[] _roles;

    public AuthorizeRolesAttribute(params string[] roles)
    {
        _roles = roles;
    }

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        // 1. Kiểm tra xác thực
        if (user.Identity == null || !user.Identity.IsAuthenticated)
        {
            context.Result = new JsonResult(new { success = false, message = "Chưa đăng nhập hệ thống" }) 
            { 
                StatusCode = StatusCodes.Status401Unauthorized 
            };
            return;
        }

        // 2. Kiểm tra vai trò (so sánh không phân biệt hoa thường)
        if (_roles.Length > 0)
        {
            var userRoles = user.FindAll(ClaimTypes.Role)
                                .Select(c => c.Value.ToLower())
                                .ToList();

            var requiredRoles = _roles.Select(r => r.ToLower());

            if (!requiredRoles.Any(role => userRoles.Contains(role)))
            {
                context.Result = new JsonResult(new { success = false, message = "Bạn không có quyền thực hiện thao tác này" }) 
                { 
                    StatusCode = StatusCodes.Status403Forbidden 
                };
                return;
            }
        }
    }
}
