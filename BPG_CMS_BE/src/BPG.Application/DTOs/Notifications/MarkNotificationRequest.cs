namespace BPG.Application.DTOs.Notifications
{
    public class MarkNotificationRequest
    {
        public long? NotificationId { get; set; }
        public bool MarkAll { get; set; }
    }
}
