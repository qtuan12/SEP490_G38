using BPG.Application.Common.Models;
using BPG.Application.DTOs.Users;
using BPG.Application.Features.Users.Commands;
using BPG.Application.Features.Users.Queries;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Authorize(Roles = RolePolicies.Admin)]
public class UsersController : BaseApiController
{
    [HttpGet]
    public async Task<IActionResult> GetUsers([FromQuery] GetUsersQuery query)
    {
        var result = await Mediator.Send(query);
        return ApiPagedOk(result, "Láº¥y danh sÃ¡ch ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng");
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser(CreateUserCommand command)
    {
        var result = await Mediator.Send(command);
        return ApiOk(result, "Táº¡o ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng");
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(long id, UpdateUserRequest request)
    {
        var result = await Mediator.Send(new UpdateUserCommand(id, request.Name, request.Email, request.Role, request.PhoneNumber));
        return ApiOk(result, "Cáº­p nháº­t ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng");
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(long id)
    {
        await Mediator.Send(new DeleteUserCommand(id));
        return ApiOk("XÃ³a ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng");
    }

    [HttpPost("{id}/toggle-status")]
    public async Task<IActionResult> ToggleUserStatus(long id)
    {
        var result = await Mediator.Send(new ToggleUserStatusCommand(id));
        return ApiOk(result, "Cáº­p nháº­t tráº¡ng thÃ¡i ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng");
    }
}

