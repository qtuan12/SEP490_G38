using BPG.Application.Common.Models;
using BPG.Application.DTOs.Notifications;
using MediatR;

namespace BPG.Application.Features.Notifications.Queries
{
    public class GetMyNotificationsQuery : PaginationRequest, IRequest<PagedList<NotificationDto>>
    {
        public long UserId { get; set; }
    }
}
