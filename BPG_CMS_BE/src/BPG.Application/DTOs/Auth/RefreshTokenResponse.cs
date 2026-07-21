namespace BPG.Application.DTOs.Auth
{
    public class RefreshTokenResponse
    {
        public string AccessToken { get; set; } = string.Empty;

        public string RefreshToken { get; set; } = string.Empty;
    }
}
