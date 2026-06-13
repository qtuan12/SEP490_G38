using AutoMapper;
using BPG.Application.DTOs.Notifications;
using BPG.Application.Features.Notifications.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Notifications.Handlers
{
    public class SendNotificationCommandHandler : IRequestHandler<SendNotificationCommand>
    {
        private readonly IUnitOfWork _uow;
        private readonly IRealtimeNotificationSender _realtimeSender;
        private readonly IMapper _mapper;

        public SendNotificationCommandHandler(IUnitOfWork uow, IRealtimeNotificationSender realtimeSender, IMapper mapper)
        {
            _uow = uow;
            _realtimeSender = realtimeSender;
            _mapper = mapper;
        }

        public async Task Handle(SendNotificationCommand request, CancellationToken cancellationToken)
        {
            // 1. Map Command sang Entity sử dụng AutoMapper
            var notification = _mapper.Map<Notification>(request);

            // Lưu thông báo vào cơ sở dữ liệu qua Repository/UnitOfWork
            await _uow.Repository<Notification>().AddAsync(notification, cancellationToken);
            await _uow.SaveChangesAsync(cancellationToken);

            // 2. Map Entity sang NotificationDto chuẩn hóa để gửi đi
            var notificationDto = _mapper.Map<NotificationDto>(notification);

            // Gửi thông báo realtime thông qua SignalR Sender
            await _realtimeSender.SendNotificationToUserAsync(
                request.UserId.ToString(),
                notificationDto,
                cancellationToken);
        }
    }
}
