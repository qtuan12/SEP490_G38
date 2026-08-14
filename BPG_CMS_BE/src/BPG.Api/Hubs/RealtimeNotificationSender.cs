using BPG.Application.IServices;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Api.Hubs
{
    public class RealtimeNotificationSender : IRealtimeNotificationSender
    {
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly ILogger<RealtimeNotificationSender> _logger;

        public RealtimeNotificationSender(
            IHubContext<NotificationHub> hubContext,
            ILogger<RealtimeNotificationSender> logger)
        {
            _hubContext = hubContext;
            _logger = logger;
        }

        private async Task SendBestEffortAsync(
            Func<Task> send,
            string destination,
            string methodName)
        {
            try
            {
                await send();
            }
            catch (Exception exception)
            {
                // Realtime delivery must not turn an already committed command into an
                // HTTP failure. Clients can recover by refreshing their persisted data.
                _logger.LogWarning(
                    exception,
                    "Could not send realtime method {MethodName} to {Destination}.",
                    methodName,
                    destination);
            }
        }

        public async Task SendNotificationToUserAsync(string userId, object notification, CancellationToken ct = default)
        {
            // Gửi sự kiện ReceiveNotification kèm theo payload thông báo đến client của user
            await SendBestEffortAsync(
                () => _hubContext.Clients.User(userId).SendAsync("ReceiveNotification", notification, cancellationToken: ct),
                $"user:{userId}",
                "ReceiveNotification");
        }

        public async Task SendNotificationToAllAsync(object notification, CancellationToken ct = default)
        {
            // Gửi sự kiện ReceiveNotification đến tất cả clients đang kết nối
            await SendBestEffortAsync(
                () => _hubContext.Clients.All.SendAsync("ReceiveNotification", notification, cancellationToken: ct),
                "all",
                "ReceiveNotification");
        }

        public async Task SendToAllAsync(string methodName, object arg, CancellationToken ct = default)
        {
            await SendBestEffortAsync(
                () => _hubContext.Clients.All.SendAsync(methodName, arg, cancellationToken: ct),
                "all",
                methodName);
        }

        public async Task SendToGroupAsync(string groupName, string methodName, object arg, CancellationToken ct = default)
        {
            await SendBestEffortAsync(
                () => _hubContext.Clients.Group(groupName).SendAsync(methodName, arg, cancellationToken: ct),
                $"group:{groupName}",
                methodName);
        }
    }
}
