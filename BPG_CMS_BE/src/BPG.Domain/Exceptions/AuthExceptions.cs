using BPG.Domain.Constants;

namespace BPG.Domain.Exceptions;

/// <summary>
/// Người dùng chưa đăng nhập hoặc token hết hạn. → 401 Unauthorized
/// </summary>
public class UnauthorizedException : DomainException
{
    public UnauthorizedException(string message = "Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.")
        : base(ErrorCodes.Unauthorized, message) { }
}

/// <summary>
/// Người dùng không có quyền thực hiện thao tác này. → 403 Forbidden
/// </summary>
public class ForbiddenException : DomainException
{
    public ForbiddenException(string message = "Bạn không có quyền thực hiện thao tác này.")
        : base(ErrorCodes.Forbidden, message) { }

    public ForbiddenException(string role, string action)
        : base(ErrorCodes.Forbidden, $"Vai trò [{role}] không có quyền [{action}].") { }
}
