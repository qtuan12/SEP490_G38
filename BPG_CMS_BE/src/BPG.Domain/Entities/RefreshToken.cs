namespace BPG.Domain.Entities;

public class RefreshToken
{
    public long RefreshTokenId { get; set; }
    public long UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public bool IsUsed { get; set; } = false;

    /// <summary>
    /// Hash của token được cấp thay thế khi rotate. Dùng để lần lại chuỗi rotation khi client
    /// mất response (reload/mất mạng giữa chừng) và gửi lại token cũ trong grace window.
    /// </summary>
    public string? ReplacedByTokenHash { get; set; }

    public User User { get; set; } = null!;
}
