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
        private readonly IUnitOfWork _uow;
        private readonly IJwtService _jwtService;

        public LoginCommandHandler(IUnitOfWork uow, IJwtService jwtService)
        {
            _uow = uow;
            _jwtService = jwtService;
        }

        public async Task<LoginResponse> Handle(
            LoginCommand request,
            CancellationToken cancellationToken)
        {
            var user = await _uow.Repository<User>().Query()
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(x => x.Email == request.Email && !x.IsDeleted, cancellationToken);

            if (user == null || !user.IsActive)
            {
                throw new UnauthorizedException("Email hoặc mật khẩu không chính xác.");
            }

            var isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
            if (!isPasswordValid)
            {
                throw new UnauthorizedException("Email hoặc mật khẩu không chính xác.");
            }

            var roleName = user.UserRoles.FirstOrDefault()?.Role?.RoleName ?? "User";

            return new LoginResponse
            {
                UserId = user.UserId,
                FullName = user.FullName,
                Email = user.Email,
                Role = roleName,
                AccessToken = _jwtService.GenerateToken(user)
            };
        }
    }
}
