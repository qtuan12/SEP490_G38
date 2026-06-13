using System;

namespace BPG.Application.DTOs.Notifications
{
    public class NotificationDto
    {
        public long NotificationId { get; set; }
        public long UserId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string NotificationType { get; set; } = string.Empty;
        public string? ReferenceType { get; set; }
        public long? ReferenceId { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ReadAt { get; set; }
    }
}
