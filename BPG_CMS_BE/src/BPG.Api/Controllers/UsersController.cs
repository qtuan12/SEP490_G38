using BPG.Application.Common.Models;
using BPG.Application.DTOs.Users;
using BPG.Application.Features.Users.Commands;
using BPG.Application.Features.Users.Queries;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Authorize]
public class UsersController : BaseApiController
{
    [HttpGet]
    [Authorize(Roles = RolePolicies.AdminOrTechnicalManager)]
    public async Task<IActionResult> GetUsers([FromQuery] GetUsersQuery query)
    {
        var result = await Mediator.Send(query);
        return ApiPagedOk(result, "Lấy danh sách người dùng thành công");
    }

    [HttpPost]
    [Authorize(Roles = RolePolicies.Admin)]
    public async Task<IActionResult> CreateUser(CreateUserCommand command)
    {
        var result = await Mediator.Send(command);
        return ApiOk(result, $"Đã tạo tài khoản cho '{result.Name}' thành công.");
    }

    [HttpPut("{id}")]
    [Authorize(Roles = RolePolicies.Admin)]
    public async Task<IActionResult> UpdateUser(long id, UpdateUserRequest request)
    {
        var result = await Mediator.Send(new UpdateUserCommand(id, request.Name, request.Email, request.Role, request.PhoneNumber));
        return ApiOk(result, $"Đã cập nhật tài khoản '{result.Name}' thành công.");
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = RolePolicies.Admin)]
    public async Task<IActionResult> DeleteUser(long id)
    {
        var name = await Mediator.Send(new DeleteUserCommand(id));
        return ApiOk($"Đã xóa tài khoản '{name}' khỏi hệ thống.");
    }

    [HttpPost("{id}/toggle-status")]
    [Authorize(Roles = RolePolicies.Admin)]
    public async Task<IActionResult> ToggleUserStatus(long id)
    {
        var result = await Mediator.Send(new ToggleUserStatusCommand(id));
        // Nói rõ đã khóa hay mở khóa — message chung chung khiến người dùng phải tự đối chiếu lại bảng.
        var action = result.Status == "active" ? "mở khóa" : "khóa";
        return ApiOk(result, $"Đã {action} tài khoản '{result.Name}'.");
    }
}

