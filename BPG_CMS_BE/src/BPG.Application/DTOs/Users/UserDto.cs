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

        public static UserDto FromEntity(User user)
        {
            return new UserDto
            {
                Id = user.UserId.ToString(),
                Name = user.FullName,
                Email = user.Email,
                Role = user.UserRoles?.FirstOrDefault()?.Role?.RoleName ?? string.Empty,
                Status = user.IsActive ? "Active" : "Inactive"
            };
        }
    }
}
