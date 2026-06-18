namespace BPG.Application.DTOs.Auth
{
    public class GetCurrentUserDto
    {
        public long UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public DateTime? PasswordChangedAt { get; set; }
    }
}
