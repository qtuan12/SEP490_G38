using BPG.Domain.Entities;
using System.Linq;

namespace BPG.Application.DTOs.Users
{
    public class UserDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public string? PhoneNumber { get; set; }

        public static UserDto FromEntity(User user)
        {
            return new UserDto
            {
                Id = user.UserId.ToString(),
                Name = user.FullName,
                Email = user.Email,
                Role = (user.UserRoles?.FirstOrDefault()?.Role?.RoleName ?? string.Empty).ToLower(),
                Status = GetStatus(user),
                AvatarUrl = user.AvatarUrl,
                PhoneNumber = user.PhoneNumber
            };
        }
        public static string GetStatus(User user)
        {
            if (!user.IsActive) return "locked";
            if (user.LockedUntil.HasValue && user.LockedUntil > DateTime.UtcNow) return "locked";
            return "active";
        }
    }
}
