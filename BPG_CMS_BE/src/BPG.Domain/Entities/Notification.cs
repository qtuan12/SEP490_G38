namespace BPG.Domain.Entities;

public class Notification
{
    public long NotificationId { get; set; }
    public long UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string NotificationType { get; set; } = string.Empty;
    public string? ReferenceType { get; set; }
    public long? ReferenceId { get; set; }
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; }
    public DateTime? ReadAt { get; set; }

    public User User { get; set; } = null!;
}
