using BPG.Application.Features.Notifications.Commands;
using BPG.Application.IServices;
using MediatR;
using Microsoft.Extensions.Logging;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Infrastructure.Services
{
    public class NotificationService : INotificationService
    {
        private readonly IMediator _mediator;
        private readonly ILogger<NotificationService> _logger;

        public NotificationService(IMediator mediator, ILogger<NotificationService> logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        private async Task SendBestEffortAsync(SendNotificationCommand command, CancellationToken ct)
        {
            try
            {
                await _mediator.Send(command, ct);
            }
            catch (Exception exception)
            {
                // Notifications are a secondary side effect. The business operation may
                // already be committed, so propagating this error would invite a duplicate retry.
                _logger.LogError(
                    exception,
                    "Could not dispatch notification {NotificationType} for reference {ReferenceType}/{ReferenceId}.",
                    command.NotificationType,
                    command.ReferenceType,
                    command.ReferenceId);
            }
        }

        public async Task SendNotificationAsync(
            long userId,
            string title,
            string content,
            string notificationType,
            string? referenceType = null,
            long? referenceId = null,
            CancellationToken ct = default)
        {
            // Gửi Command qua MediatR, Handler sẽ đảm nhận việc lưu DB và bắn realtime
            await SendBestEffortAsync(new SendNotificationCommand(
                UserId: userId,
                Title: title,
                Content: content,
                NotificationType: notificationType,
                SendToAll: false,
                RoleName: null,
                ReferenceType: referenceType,
                ReferenceId: referenceId
            ), ct);
        }

        public async Task SendNotificationToAllAsync(
            string title,
            string content,
            string notificationType,
            string? referenceType = null,
            long? referenceId = null,
            CancellationToken ct = default)
        {
            await SendBestEffortAsync(new SendNotificationCommand(
                UserId: null,
                Title: title,
                Content: content,
                NotificationType: notificationType,
                SendToAll: true,
                RoleName: null,
                ReferenceType: referenceType,
                ReferenceId: referenceId
            ), ct);
        }

        public async Task SendNotificationToRoleAsync(
            string roleName,
            string title,
            string content,
            string notificationType,
            string? referenceType = null,
            long? referenceId = null,
            CancellationToken ct = default)
        {
            await SendBestEffortAsync(new SendNotificationCommand(
                UserId: null,
                Title: title,
                Content: content,
                NotificationType: notificationType,
                SendToAll: false,
                RoleName: roleName,
                ReferenceType: referenceType,
                ReferenceId: referenceId
            ), ct);
        }

        public async Task SendNotificationToRoleAsync(
            string roleName,
            string title,
            string content,
            string notificationType,
            long excludeUserId,
            string? referenceType = null,
            long? referenceId = null,
            CancellationToken ct = default)
        {
            await SendBestEffortAsync(new SendNotificationCommand(
                UserId: null,
                Title: title,
                Content: content,
                NotificationType: notificationType,
                SendToAll: false,
                RoleName: roleName,
                ReferenceType: referenceType,
                ReferenceId: referenceId,
                ExcludeUserId: excludeUserId
            ), ct);
        }
    }
}
