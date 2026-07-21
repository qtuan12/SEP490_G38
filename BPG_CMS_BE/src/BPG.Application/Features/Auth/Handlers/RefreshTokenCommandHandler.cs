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
                // Refresh token cũ bị tái sử dụng → nghi ngờ bị đánh cắp, thu hồi toàn bộ token còn hiệu lực của user.
                var activeTokens = await _uow.Repository<RefreshToken>().Query()
                    .Where(rt => rt.UserId == storedToken.UserId && rt.RevokedAt == null)
                    .ToListAsync(cancellationToken);

                foreach (var t in activeTokens)
                    t.RevokedAt = DateTime.UtcNow;

                await _uow.SaveChangesAsync(cancellationToken);
                throw new UnauthorizedException("Refresh token đã được sử dụng. Vui lòng đăng nhập lại.");
            }

            if (storedToken.ExpiresAt < DateTime.UtcNow)
                throw new UnauthorizedException("Refresh token đã hết hạn. Vui lòng đăng nhập lại.");

            var user = storedToken.User;
            if (!user.IsActive || user.IsDeleted)
                throw new UnauthorizedException("Tài khoản không khả dụng.");

            storedToken.IsUsed = true;
            storedToken.RevokedAt = DateTime.UtcNow;

            var newRawToken = _jwtService.GenerateRefreshToken();
            await _uow.Repository<RefreshToken>().AddAsync(new RefreshToken
            {
                UserId = user.UserId,
                TokenHash = _jwtService.HashToken(newRawToken),
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
    }
}
