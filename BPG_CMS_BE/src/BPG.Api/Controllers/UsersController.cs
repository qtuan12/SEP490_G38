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
    public async Task<IActionResult> GetUsers()
    {
        var result = await Mediator.Send(new GetUsersQuery());
        return ApiOk(result, "Lấy danh sách người dùng thành công");
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser(CreateUserCommand command)
    {
        var result = await Mediator.Send(command);
        return ApiOk(result, "Tạo người dùng thành công");
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(long id, UpdateUserRequest request)
    {
        var result = await Mediator.Send(new UpdateUserCommand(id, request.Name, request.Email, request.Role));
        if (result == null)
            return ApiNotFound("Không tìm thấy người dùng.");
        return ApiOk(result, "Cập nhật người dùng thành công");
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(long id)
    {
        var deleted = await Mediator.Send(new DeleteUserCommand(id));
        if (!deleted)
            return ApiNotFound("Không tìm thấy người dùng.");
        return ApiOk("Xóa người dùng thành công");
    }

    [HttpPost("{id}/toggle-status")]
    public async Task<IActionResult> ToggleUserStatus(long id)
    {
        var result = await Mediator.Send(new ToggleUserStatusCommand(id));
        if (result == null)
            return ApiNotFound("Không tìm thấy người dùng.");
        return ApiOk(result, "Cập nhật trạng thái người dùng thành công");
    }
}
