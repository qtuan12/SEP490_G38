using BPG.Application.IServices;
using Microsoft.AspNetCore.SignalR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Api.Hubs
{
    public class RealtimeNotificationSender : IRealtimeNotificationSender
    {
        private readonly IHubContext<NotificationHub> _hubContext;

        public RealtimeNotificationSender(IHubContext<NotificationHub> hubContext)
        {
            _hubContext = hubContext;
        }

        public async Task SendNotificationToUserAsync(string userId, object notification, CancellationToken ct = default)
        {
            // Gửi sự kiện ReceiveNotification kèm theo payload thông báo đến client của user
            await _hubContext.Clients.User(userId).SendAsync("ReceiveNotification", notification, cancellationToken: ct);
        }

        public async Task SendNotificationToAllAsync(object notification, CancellationToken ct = default)
        {
            // Gửi sự kiện ReceiveNotification đến tất cả clients đang kết nối
            await _hubContext.Clients.All.SendAsync("ReceiveNotification", notification, cancellationToken: ct);
        }
    }
}
