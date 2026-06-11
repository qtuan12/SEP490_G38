using BPG.Application.Common.Models;
using BPG.Application.Features.Auth.Commands;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Route("api/auth")]
public class AuthController : BaseApiController
{
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginCommand command)
    {
        var result = await Mediator.Send(command);

        if (result == null)
        {
            return Unauthorized(ApiResponse<string>.FailureResult("Email or password is incorrect"));
        }

        return ApiOk(result, "Đăng nhập thành công");
    }
}