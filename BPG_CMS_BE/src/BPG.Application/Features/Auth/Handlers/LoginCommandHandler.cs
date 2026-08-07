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
    public class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResponse>
    {
        private const int MaxFailedAttempts = 5;
        private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

        private readonly IUnitOfWork _uow;
        private readonly IJwtService _jwtService;

        public LoginCommandHandler(IUnitOfWork uow, IJwtService jwtService)
        {
            _uow = uow;
            _jwtService = jwtService;
        }

        public async Task<LoginResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
        {
            var user = await _uow.Repository<User>().Query()
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(x => x.Email == request.Email && !x.IsDeleted, cancellationToken);

            if (user == null || !user.IsActive)
                throw new UnauthorizedException("Email hoặc mật khẩu không chính xác.");

            if (user.LockedUntil.HasValue && user.LockedUntil > DateTime.UtcNow)
            {
                var remaining = user.LockedUntil.Value - DateTime.UtcNow;
                var mins = (int)remaining.TotalMinutes;
                var secs = remaining.Seconds;
                throw new UnauthorizedException($"Tài khoản đang bị khóa. Vui lòng thử lại sau {mins} phút {secs} giây.");
            }

            if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                user.FailedLoginCount++;

                if (user.FailedLoginCount >= MaxFailedAttempts)
                {
                    user.LockedUntil = DateTime.UtcNow.Add(LockoutDuration);
                    user.FailedLoginCount = 0;
                    await _uow.SaveChangesAsync(cancellationToken);
                    throw new UnauthorizedException($"Tài khoản đã bị khóa {(int)LockoutDuration.TotalMinutes} phút do nhập sai mật khẩu quá {MaxFailedAttempts} lần.");
                }

                await _uow.SaveChangesAsync(cancellationToken);
                var attemptsLeft = MaxFailedAttempts - user.FailedLoginCount;
                throw new UnauthorizedException($"Email hoặc mật khẩu không chính xác. (Còn {attemptsLeft} lần thử)");
            }

            user.FailedLoginCount = 0;
            user.LockedUntil = null;
            user.LastLoginAt = DateTime.UtcNow;
            await _uow.SaveChangesAsync(cancellationToken);

            var rawRefreshToken = _jwtService.GenerateRefreshToken();
            await _uow.Repository<RefreshToken>().AddAsync(new RefreshToken
            {
                UserId = user.UserId,
                TokenHash = _jwtService.HashToken(rawRefreshToken),
                ExpiresAt = DateTime.UtcNow.AddDays(_jwtService.RefreshTokenExpiryDays),
                CreatedAt = DateTime.UtcNow
            }, cancellationToken);
            await _uow.SaveChangesAsync(cancellationToken);

            var roles = user.UserRoles
                .Where(userRole => userRole.Role != null)
                .Select(userRole => userRole.Role!.RoleName)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(role => role, StringComparer.Ordinal)
                .ToList();

            return new LoginResponse
            {
                UserId = user.UserId,
                FullName = user.FullName,
                Email = user.Email,
                Role = roles.FirstOrDefault() ?? string.Empty,
                Roles = roles,
                AccessToken = _jwtService.GenerateToken(user),
                RefreshToken = rawRefreshToken
            };
        }
    }
}



