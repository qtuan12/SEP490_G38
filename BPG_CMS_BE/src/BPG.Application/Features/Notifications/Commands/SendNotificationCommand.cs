using MediatR;

namespace BPG.Application.Features.Notifications.Commands
{
    public record SendNotificationCommand(
        long UserId,
        string Title,
        string Content,
        string NotificationType,
        string? ReferenceType = null,
        long? ReferenceId = null
    ) : IRequest;
}
