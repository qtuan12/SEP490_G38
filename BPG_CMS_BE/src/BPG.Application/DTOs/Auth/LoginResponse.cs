namespace BPG.Application.DTOs.Auth
{
    public class LoginResponse
    {
        public long UserId { get; set; }

        public string FullName { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public string Role { get; set; } = string.Empty;

        public string AccessToken { get; set; } = string.Empty;
    }
}
