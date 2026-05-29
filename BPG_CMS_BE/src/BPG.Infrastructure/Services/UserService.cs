using BPG.Application.DTOs.Users;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BPG.Infrastructure.Services
{
    public class UserService : IUserService
    {
        private readonly AppDbContext _context;

        public UserService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<UserDto>> GetUsersAsync()
        {
            var users = await _context.Users.ToListAsync();
            return users.Select(ToDto).ToList();
        }

        public async Task<UserDto> CreateUserAsync(string name, string email, string role)
        {
            if (await _context.Users.AnyAsync(u => u.Email.ToLower() == email.ToLower()))
                throw new InvalidOperationException("Email đã tồn tại trong hệ thống.");

            var newUser = new User
            {
                Id = Guid.NewGuid(),
                FullName = name,
                Email = email,
                Role = NormalizeRole(role),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();

            return ToDto(newUser);
        }

        public async Task<UserDto?> UpdateUserAsync(Guid id, string? name, string? email, string? role)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return null;

            if (!string.IsNullOrEmpty(email) && !email.Equals(user.Email, StringComparison.OrdinalIgnoreCase))
            {
                if (await _context.Users.AnyAsync(u => u.Email.ToLower() == email.ToLower() && u.Id != id))
                    throw new InvalidOperationException("Email đã được sử dụng bởi tài khoản khác.");
                user.Email = email;
            }

            if (!string.IsNullOrEmpty(name))
                user.FullName = name;

            if (!string.IsNullOrEmpty(role))
                user.Role = NormalizeRole(role);

            await _context.SaveChangesAsync();
            return ToDto(user);
        }

        public async Task<bool> DeleteUserAsync(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return false;

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<UserDto?> ToggleUserStatusAsync(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return null;

            user.IsActive = !user.IsActive;
            await _context.SaveChangesAsync();
            return ToDto(user);
        }

        // ─── Helpers ───────────────────────────────────────────────────────────────

        private static UserDto ToDto(User u) => new()
        {
            Id = u.Id.ToString(),
            Name = u.FullName,
            Email = u.Email,
            Role = u.Role.ToLower(),
            Status = u.IsActive ? "active" : "locked"
        };

        private static string NormalizeRole(string role) => role.ToLower() switch
        {
            "admin"     => "Admin",
            "tpkt"      => "Tpkt",
            "kỹ sư"    => "Kỹ sư",
            "giám đốc" => "Giám đốc",
            "kế toán"  => "Kế toán",
            _           => role
        };
    }
}
