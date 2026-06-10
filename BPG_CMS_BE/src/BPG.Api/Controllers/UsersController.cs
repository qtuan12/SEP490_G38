using BPG.Application.Features.Users.Commands;
using BPG.Application.Features.Users.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IMediator _mediator;

    public UsersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var result = await _mediator.Send(new GetUsersQuery());
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser(CreateUserCommand command)
    {
        try
        {
            var result = await _mediator.Send(command);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(long id, UpdateUserRequest request)
    {
        try
        {
            var result = await _mediator.Send(new UpdateUserCommand(id, request.Name, request.Email, request.Role));
            if (result == null)
                return NotFound(new { message = "Không tìm thấy người dùng." });
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(long id)
    {
        var deleted = await _mediator.Send(new DeleteUserCommand(id));
        if (!deleted)
            return NotFound(new { message = "Không tìm thấy người dùng." });
        return NoContent();
    }

    [HttpPost("{id}/toggle-status")]
    public async Task<IActionResult> ToggleUserStatus(long id)
    {
        var result = await _mediator.Send(new ToggleUserStatusCommand(id));
        if (result == null)
            return NotFound(new { message = "Không tìm thấy người dùng." });
        return Ok(result);
    }
}

/// <summary>Request body cho PUT /api/users/{id} — chỉ chứa các trường cần update.</summary>
public class UpdateUserRequest
{
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Role { get; set; }
}
