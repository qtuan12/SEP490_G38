using BPG.Application.DTOs.Auth;
using BPG.Application.Features.Auth.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Auth.Handlers
{
    public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, RefreshTokenResponse>
    {
        /// <summary>
        /// Khoảng thời gian sau khi rotate mà token cũ vẫn được chấp nhận để lấy tiếp token kế nhiệm.
        /// Đủ ngắn để không làm mất ý nghĩa của reuse-detection, đủ dài để chịu được reload liên tục.
        /// </summary>
        private static readonly TimeSpan RotationGracePeriod = TimeSpan.FromSeconds(60);

        /// <summary>Số bước tối đa khi lần theo chuỗi rotation, tránh lặp vô hạn nếu dữ liệu lỗi.</summary>
        private const int MaxRotationChainHops = 5;

        private readonly IUnitOfWork _uow;
        private readonly IJwtService _jwtService;

        public RefreshTokenCommandHandler(IUnitOfWork uow, IJwtService jwtService)
        {
            _uow = uow;
            _jwtService = jwtService;
        }

        public async Task<RefreshTokenResponse> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
        {
            var tokenHash = _jwtService.HashToken(request.RefreshToken);

            var storedToken = await _uow.Repository<RefreshToken>().Query()
                .Include(rt => rt.User)
                    .ThenInclude(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash, cancellationToken)
                ?? throw new UnauthorizedException("Refresh token không hợp lệ.");

            if (storedToken.IsUsed || storedToken.RevokedAt.HasValue)
            {
                // Client có thể đã mất response của lần rotate trước (reload/mất mạng giữa chừng) nên
                // gửi lại token cũ. Trong grace window thì lần theo chuỗi rotation để cấp tiếp,
                // thay vì coi là token bị đánh cắp và đá user ra ngoài.
                var successor = await FindGraceSuccessorAsync(storedToken, cancellationToken);
                if (successor == null)
                {
                    // Refresh token cũ bị tái sử dụng → nghi ngờ bị đánh cắp, thu hồi toàn bộ token còn hiệu lực của user.
                    var activeTokens = await _uow.Repository<RefreshToken>().Query()
                        .Where(rt => rt.UserId == storedToken.UserId && rt.RevokedAt == null)
                        .ToListAsync(cancellationToken);

                    foreach (var t in activeTokens)
                        t.RevokedAt = DateTime.UtcNow;

                    await _uow.SaveChangesAsync(cancellationToken);
                    throw new UnauthorizedException("Refresh token đã được sử dụng. Vui lòng đăng nhập lại.");
                }

                storedToken = successor;
            }

            if (storedToken.ExpiresAt < DateTime.UtcNow)
                throw new UnauthorizedException("Refresh token đã hết hạn. Vui lòng đăng nhập lại.");

            // Tài khoản bị xóa mềm sẽ bị query filter loại khỏi Include nên navigation về null —
            // phải kiểm null, nếu không sẽ ném NullReferenceException và trả 500 thay vì 401.
            var user = storedToken.User;
            if (user == null || !user.IsActive)
                throw new UnauthorizedException("Tài khoản không khả dụng.");

            var newRawToken = _jwtService.GenerateRefreshToken();
            var newTokenHash = _jwtService.HashToken(newRawToken);

            storedToken.IsUsed = true;
            storedToken.RevokedAt = DateTime.UtcNow;
            storedToken.ReplacedByTokenHash = newTokenHash;

            await _uow.Repository<RefreshToken>().AddAsync(new RefreshToken
            {
                UserId = user.UserId,
                TokenHash = newTokenHash,
                ExpiresAt = DateTime.UtcNow.AddDays(_jwtService.RefreshTokenExpiryDays),
                CreatedAt = DateTime.UtcNow
            }, cancellationToken);

            await _uow.SaveChangesAsync(cancellationToken);

            return new RefreshTokenResponse
            {
                AccessToken = _jwtService.GenerateToken(user),
                RefreshToken = newRawToken
            };
        }

        /// <summary>
        /// Lần theo chuỗi rotation từ một token đã dùng để tìm token còn hiệu lực ở cuối chuỗi.
        /// Trả về null nếu ngoài grace window, chuỗi bị đứt, hoặc token bị thu hồi vì lý do khác
        /// (logout, reuse-detection) — khi đó caller xử lý như tái sử dụng trái phép.
        /// </summary>
        private async Task<RefreshToken?> FindGraceSuccessorAsync(RefreshToken usedToken, CancellationToken cancellationToken)
        {
            var current = usedToken;

            for (var hop = 0; hop < MaxRotationChainHops; hop++)
            {
                // Token bị thu hồi mà không có token thay thế nghĩa là logout hoặc reuse-detection,
                // không phải rotation → không được cấp tiếp.
                if (!current.IsUsed || current.ReplacedByTokenHash == null || !current.RevokedAt.HasValue)
                    return null;

                if (DateTime.UtcNow - current.RevokedAt.Value > RotationGracePeriod)
                    return null;

                var successorHash = current.ReplacedByTokenHash;
                var next = await _uow.Repository<RefreshToken>().Query()
                    .Include(rt => rt.User)
                        .ThenInclude(u => u.UserRoles)
                            .ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(rt => rt.TokenHash == successorHash, cancellationToken);

                if (next == null)
                    return null;

                if (!next.IsUsed && !next.RevokedAt.HasValue)
                    return next;

                current = next;
            }

            return null;
        }
    }
}
