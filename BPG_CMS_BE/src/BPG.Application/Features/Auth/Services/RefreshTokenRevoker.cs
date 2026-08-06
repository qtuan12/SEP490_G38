using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Auth.Services
{
    /// <summary>
    /// Thu hồi phiên đăng nhập. Gọi ở mọi chỗ mà quyền truy cập của một tài khoản thay đổi:
    /// xóa tài khoản, khóa tài khoản, đổi mật khẩu, đặt lại mật khẩu.
    ///
    /// Không có bước này thì người giữ refresh token vẫn tự gia hạn phiên và dùng tiếp — đúng
    /// tình huống mà người dùng đổi mật khẩu vì nghi bị lộ tài khoản lại không cắt được kẻ tấn công.
    /// </summary>
    internal static class RefreshTokenRevoker
    {
        /// <summary>
        /// Đánh dấu thu hồi mọi refresh token còn hiệu lực của một tài khoản.
        /// Chỉ ghi vào change tracker — người gọi tự quyết định thời điểm SaveChanges.
        /// </summary>
        public static async Task RevokeAllAsync(IUnitOfWork uow, long userId, CancellationToken ct)
        {
            var activeTokens = await uow.Repository<RefreshToken>().Query()
                .Where(rt => rt.UserId == userId && rt.RevokedAt == null)
                .ToListAsync(ct);

            foreach (var token in activeTokens)
            {
                token.RevokedAt = DateTime.UtcNow;
                uow.Repository<RefreshToken>().Update(token);
            }
        }
    }
}
