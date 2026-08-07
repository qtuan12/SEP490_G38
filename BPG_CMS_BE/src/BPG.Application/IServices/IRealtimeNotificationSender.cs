using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.IServices
{
    public interface IRealtimeNotificationSender
    {
        /// <summary>
        /// Gửi thông báo realtime đến một người dùng cụ thể.
        /// </summary>
        /// <param name="userId">ID người nhận dạng string</param>
        /// <param name="notification">Đối tượng payload thông báo (có thể là DTO hoặc Entity)</param>
        /// <param name="ct">CancellationToken</param>
        Task SendNotificationToUserAsync(string userId, object notification, CancellationToken ct = default);

        /// <summary>
        /// Gửi thông báo realtime đến tất cả người dùng đang kết nối.
        /// </summary>
        /// <param name="notification">Đối tượng DTO thông báo</param>
        /// <param name="ct">CancellationToken</param>
        Task SendNotificationToAllAsync(object notification, CancellationToken ct = default);

        /// <summary>
        /// Gửi một sự kiện realtime bất kỳ đến tất cả client đang kết nối.
        /// </summary>
        Task SendToAllAsync(string methodName, object arg, CancellationToken ct = default);

        /// <summary>
        /// Gửi một sự kiện realtime kèm payload đến một nhóm SignalR cụ thể.
        /// </summary>
        Task SendToGroupAsync(string groupName, string methodName, object arg, CancellationToken ct = default);
    }
}
