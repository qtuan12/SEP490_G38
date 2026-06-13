using BPG.Application.IServices;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Infrastructure.Services
{
    public class NotificationService : INotificationService
    {
        public Task SendNotificationAsync(
            long userId,
            string title,
            string content,
            string notificationType,
            string? referenceType = null,
            long? referenceId = null,
            CancellationToken ct = default)
        {
            // Tạm thời trả về CompletedTask ở Phase 1 để unblock hệ thống
            // Logic lưu Database và SignalR Realtime sẽ được triển khai đầy đủ ở Phase 3
            return Task.CompletedTask;
        }
    }
}
