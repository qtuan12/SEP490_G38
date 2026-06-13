using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.IServices
{
    public interface INotificationService
    {
        /// <summary>
        /// Gửi thông báo đến một người dùng cụ thể.
        /// </summary>
        /// <param name="userId">ID người nhận thông báo</param>
        /// <param name="title">Tiêu đề thông báo</param>
        /// <param name="content">Nội dung thông báo</param>
        /// <param name="notificationType">Loại thông báo (lấy từ NotificationType constants)</param>
        /// <param name="referenceType">Loại thực thể tham chiếu (lấy từ NotificationReferenceType constants)</param>
        /// <param name="referenceId">ID thực thể tham chiếu</param>
        /// <param name="ct">CancellationToken</param>
        Task SendNotificationAsync(
            long userId,
            string title,
            string content,
            string notificationType,
            string? referenceType = null,
            long? referenceId = null,
            CancellationToken ct = default);

        /// <summary>
        /// Gửi thông báo đến toàn bộ người dùng đang kích hoạt trong hệ thống.
        /// </summary>
        Task SendNotificationToAllAsync(
            string title,
            string content,
            string notificationType,
            string? referenceType = null,
            long? referenceId = null,
            CancellationToken ct = default);

        /// <summary>
        /// Gửi thông báo đến toàn bộ người dùng thuộc một Vai Trò (Role) cụ thể.
        /// </summary>
        Task SendNotificationToRoleAsync(
            string roleName,
            string title,
            string content,
            string notificationType,
            string? referenceType = null,
            long? referenceId = null,
            CancellationToken ct = default);
    }
}
