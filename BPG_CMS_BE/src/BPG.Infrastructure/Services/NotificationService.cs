using BPG.Application.Features.Notifications.Commands;
using BPG.Application.IServices;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Infrastructure.Services
{
    public class NotificationService : INotificationService
    {
        private readonly IMediator _mediator;

        public NotificationService(IMediator mediator)
        {
            _mediator = mediator;
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
            await _mediator.Send(new SendNotificationCommand(
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
            await _mediator.Send(new SendNotificationCommand(
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
            await _mediator.Send(new SendNotificationCommand(
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
            await _mediator.Send(new SendNotificationCommand(
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
