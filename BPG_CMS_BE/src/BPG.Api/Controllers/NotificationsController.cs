using BPG.Application.Common.Models;
using BPG.Application.DTOs.Notifications;
using BPG.Application.Features.Notifications.Commands;
using BPG.Application.Features.Notifications.Queries;
using BPG.Application.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace BPG.Api.Controllers
{
    [Authorize]
    public class NotificationsController : BaseApiController
    {
        private readonly ICurrentUserService _currentUserService;

        public NotificationsController(ICurrentUserService currentUserService)
        {
            _currentUserService = currentUserService;
        }

        /// <summary>
        /// Lấy danh sách thông báo phân trang của người dùng hiện tại.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetMyNotifications([FromQuery] GetMyNotificationsQuery query)
        {
            var result = await Mediator.Send(query);
            return ApiPagedOk(result, "Lấy danh sách thông báo thành công");
        }

        /// <summary>
        /// Đánh dấu một hoặc tất cả thông báo của người dùng hiện tại là đã đọc.
        /// </summary>
        [HttpPost("mark-read")]
        public async Task<IActionResult> MarkAsRead([FromBody] MarkNotificationRequest request)
        {
            var command = new MarkNotificationAsReadCommand(
                UserId: _currentUserService.GetRequiredUserId(),
                NotificationId: request.NotificationId,
                MarkAll: request.MarkAll
            );
            var result = await Mediator.Send(command);
            return ApiOk(result, "Cập nhật trạng thái đọc thông báo thành công");
        }

        /// <summary>
        /// API test tạo thông báo realtime cho một UserId bất kỳ (Có thể xóa sau khi test xong).
        /// </summary>
        [HttpPost("test-create")]
        [AllowAnonymous]
        public async Task<IActionResult> TestCreateNotification(
            [FromBody] TestNotificationRequest request,
            [FromServices] BPG.Application.IRepositories.IUnitOfWork uow,
            [FromServices] IRealtimeNotificationSender realtimeSender)
        {
            var notification = new BPG.Domain.Entities.Notification
            {
                UserId = request.UserId,
                Title = request.Title,
                Content = request.Content,
                NotificationType = "Test",
                IsRead = false,
                CreatedAt = System.DateTime.UtcNow
            };

            await uow.Repository<BPG.Domain.Entities.Notification>().AddAsync(notification);
            await uow.SaveChangesAsync();

            // Gửi realtime qua SignalR
            var dto = new NotificationDto
            {
                NotificationId = notification.NotificationId,
                UserId = notification.UserId,
                Title = notification.Title,
                Content = notification.Content,
                NotificationType = notification.NotificationType,
                IsRead = notification.IsRead,
                CreatedAt = notification.CreatedAt
            };

            await realtimeSender.SendNotificationToUserAsync(notification.UserId.ToString(), dto);

            return Ok(new { Success = true, Message = "Tạo thông báo test thành công và đã gửi realtime", Data = dto });
        }
    }

    public class TestNotificationRequest
    {
        public long UserId { get; set; }
        public string Title { get; set; } = "Thông báo test";
        public string Content { get; set; } = "Nội dung thông báo test realtime";
    }
}
