using BPG.Application.Common.Models;
using BPG.Application.DTOs.Users;
using BPG.Application.Features.Users.Commands;
using BPG.Application.Features.Users.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Authorize]
public class UsersController : BaseApiController
{
    [HttpGet]
    public async Task<IActionResult> GetUsers([FromQuery] GetUsersQuery query)
    {
        var result = await Mediator.Send(query);
        return ApiPagedOk(result, "Lấy danh sách người dùng thành công");
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateUser(CreateUserCommand command)
    {
        var result = await Mediator.Send(command);
        return ApiOk(result, "Tạo người dùng thành công");
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateUser(long id, UpdateUserRequest request)
    {
        var result = await Mediator.Send(new UpdateUserCommand(id, request.Name, request.Email, request.Role, request.PhoneNumber));
        return ApiOk(result, "Cập nhật người dùng thành công");
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteUser(long id)
    {
        await Mediator.Send(new DeleteUserCommand(id));
        return ApiOk("Xóa người dùng thành công");
    }

    [HttpPost("{id}/toggle-status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ToggleUserStatus(long id)
    {
        var result = await Mediator.Send(new ToggleUserStatusCommand(id));
        return ApiOk(result, "Cập nhật trạng thái người dùng thành công");
    }
}
