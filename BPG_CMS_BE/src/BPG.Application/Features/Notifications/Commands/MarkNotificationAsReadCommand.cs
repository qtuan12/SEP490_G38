using MediatR;

namespace BPG.Application.Features.Notifications.Commands
{
    public record MarkNotificationAsReadCommand(
        long UserId,
        long? NotificationId = null,
        bool MarkAll = false
    ) : IRequest<bool>;
}
