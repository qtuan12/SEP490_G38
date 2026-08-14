using MediatR;

namespace BPG.Application.Features.Notifications.Queries;

public record GetUnreadNotificationCountQuery : IRequest<int>;
