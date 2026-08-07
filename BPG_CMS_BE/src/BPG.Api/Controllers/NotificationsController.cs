using BPG.Application.Common.Models;
using Microsoft.AspNetCore.RateLimiting;
using BPG.Api.Configuration;
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
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
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
    }
}
