using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Exceptions;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace BPG.Infrastructure.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public bool IsAuthenticated =>
        User?.Identity != null && User.Identity.IsAuthenticated;

    public long? UserId
    {
        get
        {
            if (!IsAuthenticated)
                return 1; // Mock Admin ID khi chạy local chưa đăng nhập

            var raw = User!.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(raw, out var id) ? id : null;
        }
    }

    public string? Email
    {
        get
        {
            if (!IsAuthenticated)
                return "admin@bpg.com";

            return User!.FindFirst(ClaimTypes.Email)?.Value;
        }
    }

    public IReadOnlyList<string> Roles
    {
        get
        {
            if (!IsAuthenticated)
                return new List<string> { UserRole.Admin }; // Mock Admin role khi chưa đăng nhập

            return User!.FindAll(ClaimTypes.Role)
                        .Select(c => c.Value)
                        .ToList();
        }
    }

    /// <summary>
    /// Lấy UserId, throw UnauthorizedException nếu chưa đăng nhập hoặc claim thiếu.
    /// </summary>
    public long GetRequiredUserId()
    {
        if (!IsAuthenticated)
            throw new UnauthorizedException();

        var id = UserId;
        if (id == null)
            throw new UnauthorizedException("Không thể xác định danh tính người dùng từ token.");

        return id.Value;
    }

    /// <summary>Kiểm tra user có vai trò chỉ định không (case-insensitive).</summary>
    public bool IsInRole(string role) =>
        Roles.Any(r => r.Equals(role, StringComparison.OrdinalIgnoreCase));

    /// <summary>Kiểm tra user có ít nhất 1 trong các vai trò chỉ định không.</summary>
    public bool IsInAnyRole(params string[] roles) =>
        roles.Any(IsInRole);
}
