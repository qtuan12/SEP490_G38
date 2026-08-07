using BPG.Application.DTOs.Users;
using BPG.Application.Features.Users.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using HubMethodNames = BPG.Domain.Constants.HubMethodNames;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Users.Handlers;

public class UpdateUserHandler : IRequestHandler<UpdateUserCommand, UserDto>
{
    private readonly IUnitOfWork _uow;
    private readonly IRealtimeNotificationSender _realtimeSender;

    public UpdateUserHandler(IUnitOfWork uow, IRealtimeNotificationSender realtimeSender)
    {
        _uow = uow;
        _realtimeSender = realtimeSender;
    }

    public async Task<UserDto> Handle(UpdateUserCommand cmd, CancellationToken ct)
    {
        var user = await _uow.Repository<User>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserId == cmd.Id && !u.IsDeleted, ct)
            ?? throw new NotFoundException("Không tìm thấy tài khoản cần cập nhật.");

        var newFullName = user.FullName;
        var newEmail = user.Email;
        var newPhoneNumber = user.PhoneNumber;

        if (!string.IsNullOrWhiteSpace(cmd.Email) &&
            !cmd.Email.Equals(user.Email, StringComparison.OrdinalIgnoreCase))
        {
            var emailTaken = await _uow.Repository<User>().AnyAsync(
                u => u.Email.ToLower() == cmd.Email.ToLower() && u.UserId != cmd.Id, ct);
            if (emailTaken)
                throw new DuplicateEntryException("Email", cmd.Email);
            newEmail = cmd.Email;
        }

        if (!string.IsNullOrWhiteSpace(cmd.Name))
            newFullName = cmd.Name;

        if (cmd.PhoneNumber != null)
        {
            newPhoneNumber = string.IsNullOrWhiteSpace(cmd.PhoneNumber)
                ? null
                : cmd.PhoneNumber.Replace(" ", "").Replace("-", "").Trim();
        }

        await _uow.ExecuteSqlAsync(
            $"UPDATE Users SET FullName = {newFullName}, Email = {newEmail}, PhoneNumber = {newPhoneNumber}, UpdatedAt = {DateTime.UtcNow} WHERE UserId = {cmd.Id}",
            ct);

        string roleName = string.Empty;

        if (!string.IsNullOrWhiteSpace(cmd.Role))
        {
            var role = await _uow.Repository<Role>().Query()
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.RoleName.ToLower() == cmd.Role.ToLower(), ct)
                ?? throw new NotFoundException($"Role '{cmd.Role}' không tồn tại.");

            await _uow.ExecuteSqlAsync(
                $"DELETE FROM UserRoles WHERE UserId = {cmd.Id}", ct);

            await _uow.ExecuteSqlAsync(
                $"INSERT INTO UserRoles (UserId, RoleId, CreatedAt, IsDeleted) VALUES ({cmd.Id}, {role.RoleId}, {DateTime.UtcNow}, 0)",
                ct);

            roleName = role.RoleName;
        }
        else
        {
            var currentRole = await _uow.Repository<UserRole>().Query()
                .AsNoTracking()
                .Include(ur => ur.Role)
                .Where(ur => ur.UserId == cmd.Id)
                .FirstOrDefaultAsync(ct);
            roleName = currentRole?.Role?.RoleName ?? string.Empty;
        }

        try
        {
            await _realtimeSender.SendToAllAsync(
                HubMethodNames.DataChanged,
                new
                {
                    Entities = string.IsNullOrWhiteSpace(cmd.Role)
                        ? new[] { nameof(User) }
                        : new[] { nameof(User), nameof(UserRole) },
                    ChangedAt = DateTimeOffset.UtcNow
                },
                CancellationToken.None);
        }
        catch
        {
            // Cập nhật người dùng đã thành công; client sẽ đồng bộ lại khi SignalR reconnect.
        }

        return new UserDto
        {
            Id = user.UserId.ToString(),
            Name = newFullName,
            Email = newEmail,
            PhoneNumber = newPhoneNumber,
            Role = roleName.ToLower(),
            Status = UserDto.GetStatus(user)
        };
    }
}
