using BPG.Application.Features.Auth.Commands;
using BPG.Application.Features.Auth.Handlers;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IMediator _mediator;

    public AuthController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginCommand command)
    {
        var result = await _mediator.Send(command);

        if (result == null)
        {
            return Unauthorized(new
            {
                message = "Email or password is incorrect"
            });
        }

        return Ok(result);
    }
}