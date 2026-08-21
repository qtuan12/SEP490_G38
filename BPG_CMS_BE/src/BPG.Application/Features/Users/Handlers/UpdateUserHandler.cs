using BPG.Application.DTOs.Users;
using BPG.Application.Features.Auth.Services;
using BPG.Application.Features.Users.Commands;
using BPG.Application.Features.Users.Services;
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
    private readonly ICurrentUserService _currentUserService;

    public UpdateUserHandler(
        IUnitOfWork uow, IRealtimeNotificationSender realtimeSender, ICurrentUserService currentUserService)
    {
        _uow = uow;
        _realtimeSender = realtimeSender;
        _currentUserService = currentUserService;
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

        // Vai trò hiện tại phải lấy trước mọi thay đổi: vừa để biết role có thực sự đổi hay
        // FE chỉ gửi lại nguyên giá trị cũ, vừa để các chốt chặn bên dưới kiểm đúng vai trò
        // trước khi bị xóa.
        var currentRole = await _uow.Repository<UserRole>().Query()
            .AsNoTracking()
            .Include(ur => ur.Role)
            .Where(ur => ur.UserId == cmd.Id)
            .FirstOrDefaultAsync(ct);
        var currentRoleName = currentRole?.Role?.RoleName ?? string.Empty;

        var roleChanged = !string.IsNullOrWhiteSpace(cmd.Role) &&
            !cmd.Role.Equals(currentRoleName, StringComparison.OrdinalIgnoreCase);

        Role? newRoleEntity = null;
        if (roleChanged)
        {
            newRoleEntity = await _uow.Repository<Role>().Query()
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.RoleName.ToLower() == cmd.Role!.ToLower(), ct)
                ?? throw new NotFoundException($"Role '{cmd.Role}' không tồn tại.");

            // Đổi vai trò có hậu quả giống khóa/xóa tài khoản (quyền hạn của người đó thay đổi
            // hoàn toàn) nên phải qua cùng bộ chốt chặn — trừ việc đang là trưởng dự án, vì ở
            // đây ta chủ động gỡ vai trò trưởng dự án thay vì chặn (xem bên dưới).
            const string action = "đổi vai trò";
            var currentUserId = _currentUserService.GetRequiredUserId();
            UserGuard.EnsureNotSelf(cmd.Id, currentUserId, action);
            await UserGuard.EnsureNotLastAdminAsync(_uow, cmd.Id, action, ct);
            await UserGuard.EnsureNotLastApproverWithPendingWorkAsync(_uow, cmd.Id, action, ct);
        }

        var roleName = currentRoleName;

        await _uow.BeginTransactionAsync(ct);
        try
        {
            await _uow.ExecuteSqlAsync(
                $"UPDATE Users SET FullName = {newFullName}, Email = {newEmail}, PhoneNumber = {newPhoneNumber}, UpdatedAt = {DateTime.UtcNow} WHERE UserId = {cmd.Id}",
                ct);

            if (roleChanged)
            {
                await _uow.ExecuteSqlAsync(
                    $"DELETE FROM UserRoles WHERE UserId = {cmd.Id}", ct);

                await _uow.ExecuteSqlAsync(
                    $"INSERT INTO UserRoles (UserId, RoleId, CreatedAt, IsDeleted) VALUES ({cmd.Id}, {newRoleEntity!.RoleId}, {DateTime.UtcNow}, 0)",
                    ct);

                roleName = newRoleEntity.RoleName;

                // Đổi vai trò rồi mà vẫn còn là trưởng dự án thì UI (dựa theo Role) và API
                // (dựa theo ProjectMember.IsLeader) sẽ mâu thuẫn nhau — gỡ vai trò trưởng dự án
                // ở mọi project đang giữ, bàn giao lại là việc PM làm thủ công sau.
                var leaderships = await _uow.Repository<ProjectMember>().Query()
                    .Where(m => m.UserId == cmd.Id && m.IsLeader)
                    .ToListAsync(ct);
                foreach (var membership in leaderships)
                {
                    membership.IsLeader = false;
                    _uow.Repository<ProjectMember>().Update(membership);
                }

                // Cắt phiên đăng nhập cũ: JWT access token đang mang role cũ vẫn dùng được tới
                // khi hết hạn, và refresh token có thể tự gia hạn phiên với role cũ nếu không
                // thu hồi ở đây.
                await RefreshTokenRevoker.RevokeAllAsync(_uow, cmd.Id, ct);
            }

            await _uow.SaveChangesAsync(ct);
            await _uow.CommitTransactionAsync(ct);
        }
        catch
        {
            await _uow.RollbackTransactionAsync(ct);
            throw;
        }

        try
        {
            await _realtimeSender.SendToAllAsync(
                HubMethodNames.DataChanged,
                new
                {
                    Entities = roleChanged
                        ? new[] { nameof(User), nameof(UserRole) }
                        : new[] { nameof(User) },
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
