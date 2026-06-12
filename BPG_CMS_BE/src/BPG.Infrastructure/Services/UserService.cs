using BPG.Application.DTOs.Users;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BPG.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly AppDbContext _context;

    public UserService(AppDbContext context)
    {
        _context = context;
    }

    public async System.Threading.Tasks.Task<List<UserDto>> GetUsersAsync()
    {
        var users = await _context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .ToListAsync();
        return users.Select(ToDto).ToList();
    }

    public async System.Threading.Tasks.Task<UserDto> CreateUserAsync(string name, string email, string role)
    {
        if (await _context.Users.AnyAsync(u => u.Email.ToLower() == email.ToLower()))
            throw new InvalidOperationException("Email đã tồn tại trong hệ thống.");

        var roleName = NormalizeRole(role);
        var roleEntity = await _context.Roles.FirstOrDefaultAsync(r => r.RoleName == roleName)
            ?? throw new KeyNotFoundException($"Role '{role}' không tồn tại trong hệ thống.");

        var newUser = new User
        {
            FullName = name,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        _context.UserRoles.Add(new UserRole
        {
            UserId = newUser.UserId,
            RoleId = roleEntity.RoleId,
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        newUser.UserRoles = new List<UserRole> { new UserRole { Role = roleEntity } };
        return ToDto(newUser);
    }

    public async System.Threading.Tasks.Task<UserDto?> UpdateUserAsync(long id, string? name, string? email, string? role)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.UserId == id);
        if (user == null) return null;

        if (!string.IsNullOrEmpty(email) && !email.Equals(user.Email, StringComparison.OrdinalIgnoreCase))
        {
            if (await _context.Users.AnyAsync(u => u.Email.ToLower() == email.ToLower() && u.UserId != id))
                throw new InvalidOperationException("Email đã được sử dụng bởi tài khoản khác.");
            user.Email = email;
        }

        if (!string.IsNullOrEmpty(name))
            user.FullName = name;

        if (!string.IsNullOrEmpty(role))
        {
            var roleName = NormalizeRole(role);
            var roleEntity = await _context.Roles.FirstOrDefaultAsync(r => r.RoleName == roleName);
            if (roleEntity != null)
            {
                var existingRoles = _context.UserRoles.Where(ur => ur.UserId == id);
                _context.UserRoles.RemoveRange(existingRoles);
                _context.UserRoles.Add(new UserRole { UserId = id, RoleId = roleEntity.RoleId, CreatedAt = DateTime.UtcNow });
            }
        }

        await _context.SaveChangesAsync();
        return ToDto(user);
    }

    public async System.Threading.Tasks.Task<bool> DeleteUserAsync(long id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return false;

        user.IsDeleted = true;
        await _context.SaveChangesAsync();
        return true;
    }

    public async System.Threading.Tasks.Task<UserDto?> ToggleUserStatusAsync(long id)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.UserId == id);
        if (user == null) return null;

        user.IsActive = !user.IsActive;
        await _context.SaveChangesAsync();
        return ToDto(user);
    }

    private static UserDto ToDto(User u) => new()
    {
        Id = u.UserId.ToString(),
        Name = u.FullName,
        Email = u.Email,
        Role = u.UserRoles.FirstOrDefault()?.Role?.RoleName?.ToLower() ?? "user",
        Status = u.IsActive ? "active" : "locked"
    };

    private static string NormalizeRole(string role) => role.ToLower() switch
    {
        "admin" => "Quản trị viên",
        "quản trị viên" => "Quản trị viên",
        "technicalmanager" => "Trưởng phòng Kỹ thuật",
        "trưởng phòng kỹ thuật" => "Trưởng phòng Kỹ thuật",
        "projectleader" => "Quản lý Dự án",
        "quản lý dự án" => "Quản lý Dự án",
        "siteengineer" => "Nhân viên Kỹ thuật",
        "nhân viên kỹ thuật" => "Nhân viên Kỹ thuật",
        "accountant" => "Kế toán",
        "kế toán" => "Kế toán",
        "director" => "Giám đốc",
        "giám đốc" => "Giám đốc",
        _ => role
    };
}
