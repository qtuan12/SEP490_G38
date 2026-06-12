using BPG.Application.IServices;
using Microsoft.AspNetCore.Http;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;

namespace BPG.Infrastructure.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public long? UserId
    {
        get
        {
            var user = _httpContextAccessor.HttpContext?.User;
            if (user?.Identity == null || !user.Identity.IsAuthenticated)
            {
                return 1; // Mock Admin ID khi chạy local chưa đăng nhập
            }

            var idClaim = user.FindFirst("userId")?.Value ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(idClaim, out var id) ? id : null;
        }
    }

    public string? Email
    {
        get
        {
            var user = _httpContextAccessor.HttpContext?.User;
            if (user?.Identity == null || !user.Identity.IsAuthenticated)
            {
                return "admin@bpg.com"; // Mock Admin email
            }
            return user.FindFirst(ClaimTypes.Email)?.Value ?? user.FindFirst("email")?.Value;
        }
    }

    public IReadOnlyList<string> Roles
    {
        get
        {
            var user = _httpContextAccessor.HttpContext?.User;
            if (user?.Identity == null || !user.Identity.IsAuthenticated)
            {
                return new List<string> { "Admin" }; // Mock Admin role khi chưa đăng nhập
            }

            return user.FindAll(ClaimTypes.Role)
                       .Select(c => c.Value)
                       .ToList();
        }
    }
}
