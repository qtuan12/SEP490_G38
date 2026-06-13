using AutoMapper;
using BPG.Application.DTOs.Notifications;
using BPG.Application.Features.Notifications.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
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
            var usersQuery = _uow.Repository<User>().Query().Where(u => u.IsActive && !u.IsDeleted);
            List<User> targetUsers = new();

            // 1. Xác định danh sách người nhận
            if (request.SendToAll)
            {
                targetUsers = await usersQuery.ToListAsync(cancellationToken);
            }
            else if (!string.IsNullOrWhiteSpace(request.RoleName))
            {
                targetUsers = await usersQuery
                    .Include(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                    .Where(u => u.UserRoles.Any(ur => ur.Role.RoleName == request.RoleName))
                    .ToListAsync(cancellationToken);
            }
            else if (request.UserId.HasValue)
            {
                var user = await _uow.Repository<User>().GetByIdAsync(request.UserId.Value, cancellationToken);
                if (user != null && user.IsActive && !user.IsDeleted)
                {
                    targetUsers.Add(user);
                }
            }

            if (!targetUsers.Any())
                return;

            // 2. Tạo thực thể Notification cho từng người nhận
            var notifications = new List<Notification>();
            foreach (var user in targetUsers)
            {
                var notification = _mapper.Map<Notification>(request);
                notification.UserId = user.UserId;
                notifications.Add(notification);
            }

            // Lưu hàng loạt vào cơ sở dữ liệu
            await _uow.Repository<Notification>().AddRangeAsync(notifications, cancellationToken);
            await _uow.SaveChangesAsync(cancellationToken);

            // 3. Gửi thông báo realtime qua SignalR
            if (request.SendToAll)
            {
                // Gửi một gói tin broadcast duy nhất cho tất cả clients đang kết nối để tối ưu hiệu năng
                var sampleDto = _mapper.Map<NotificationDto>(notifications.First());
                await _realtimeSender.SendNotificationToAllAsync(sampleDto, cancellationToken);
            }
            else
            {
                // Gửi realtime riêng cho từng user được nhắm tới
                foreach (var noti in notifications)
                {
                    var dto = _mapper.Map<NotificationDto>(noti);
                    await _realtimeSender.SendNotificationToUserAsync(noti.UserId.ToString(), dto, cancellationToken);
                }
            }
        }
    }
}
