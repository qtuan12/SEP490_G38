namespace BPG.Application.IServices;

public interface ICurrentUserService
{
    long? UserId { get; }
    string? Email { get; }
    IReadOnlyList<string> Roles { get; }

    /// <summary>
    /// Lấy UserId, throw UnauthorizedException nếu chưa đăng nhập.
    /// Dùng trong service thay vì tự check null.
    /// </summary>
    long GetRequiredUserId();

    /// <summary>Kiểm tra user có vai trò chỉ định không (case-insensitive).</summary>
    bool IsInRole(string role);

    /// <summary>Kiểm tra user có ít nhất 1 trong các vai trò chỉ định không.</summary>
    bool IsInAnyRole(params string[] roles);

    /// <summary>True nếu user đang được authenticated.</summary>
    bool IsAuthenticated { get; }
}
