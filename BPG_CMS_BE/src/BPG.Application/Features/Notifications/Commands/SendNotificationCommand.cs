using MediatR;

namespace BPG.Application.Features.Notifications.Commands
{
    public record SendNotificationCommand(
        long? UserId,
        string Title,
        string Content,
        string NotificationType,
        bool SendToAll = false,
        string? RoleName = null,
        string? ReferenceType = null,
        long? ReferenceId = null
    ) : IRequest;
}
