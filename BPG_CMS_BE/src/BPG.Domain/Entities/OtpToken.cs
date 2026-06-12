namespace BPG.Domain.Entities;

public class OtpToken
{
    public long OtpTokenId { get; set; }
    public long UserId { get; set; }
    public string OtpType { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; } = false;
    public DateTime? RevokedAt { get; set; }
    public int AttemptCount { get; set; } = 0;
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
}
