using BPG.Application.Common.Models;
using BPG.Application.Features.Auth.Commands;
using BPG.Application.Features.Auth.Queries;
using BPG.Domain.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace BPG.Api.Controllers;

[Route("api/auth")]
public class AuthController : BaseApiController
{
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginCommand command)
    {
        var result = await Mediator.Send(command);
        return ApiOk(result, "Đăng nhập thành công");
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!long.TryParse(userIdStr, out var userId))
            throw new UnauthorizedException("Không xác định được người dùng.");

        var result = await Mediator.Send(new GetCurrentUserQuery(userId));
        return ApiOk(result, "Lấy thông tin thành công");
    }

    [HttpPatch("me")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileCommand request)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!long.TryParse(userIdStr, out var userId))
            throw new UnauthorizedException("Không xác định được người dùng.");

        var result = await Mediator.Send(request with { UserId = userId });
        return ApiOk(result, "Cập nhật thông tin thành công");
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordCommand request)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!long.TryParse(userIdStr, out var userId))
            throw new UnauthorizedException("Không xác định được người dùng.");

        await Mediator.Send(request with { UserId = userId });
        return ApiOk("Đổi mật khẩu thành công");
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordCommand command)
    {
        await Mediator.Send(command);
        return ApiOk("Nếu email tồn tại trong hệ thống, mã OTP đã được gửi.");
    }

    [HttpPost("verify-otp")]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpCommand command)
    {
        var resetToken = await Mediator.Send(command);
        return ApiOk(new { resetToken }, "Xác thực OTP thành công.");
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordCommand command)
    {
        await Mediator.Send(command);
        return ApiOk("Đặt lại mật khẩu thành công.");
    }
}