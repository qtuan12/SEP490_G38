using BPG.Application.Features.Notifications.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Notifications.Handlers
{
    public class MarkNotificationAsReadCommandHandler : IRequestHandler<MarkNotificationAsReadCommand, bool>
    {
        private readonly IUnitOfWork _uow;

        public MarkNotificationAsReadCommandHandler(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<bool> Handle(MarkNotificationAsReadCommand request, CancellationToken cancellationToken)
        {
            // 1. Kịch bản đánh dấu đọc tất cả
            if (request.MarkAll)
            {
                var unreadNotifications = await _uow.Repository<Notification>().FindAsync(
                    n => n.UserId == request.UserId && !n.IsRead, cancellationToken);

                if (unreadNotifications.Any())
                {
                    foreach (var noti in unreadNotifications)
                    {
                        noti.IsRead = true;
                        noti.ReadAt = DateTime.UtcNow;
                        _uow.Repository<Notification>().Update(noti);
                    }
                    await _uow.SaveChangesAsync(cancellationToken);
                }
                return true;
            }

            // 2. Kịch bản đánh dấu đọc 1 thông báo cụ thể
            if (request.NotificationId.HasValue)
            {
                var notification = await _uow.Repository<Notification>().FirstOrDefaultAsync(
                    n => n.NotificationId == request.NotificationId.Value && n.UserId == request.UserId, cancellationToken);

                if (notification == null)
                    throw new NotFoundException(nameof(Notification), request.NotificationId.Value);

                if (!notification.IsRead)
                {
                    notification.IsRead = true;
                    notification.ReadAt = DateTime.UtcNow;
                    _uow.Repository<Notification>().Update(notification);
                    await _uow.SaveChangesAsync(cancellationToken);
                }
                return true;
            }

            return false;
        }
    }
}
