using BPG.Application.DTOs.Auth;
using BPG.Application.Features.Auth.Commands;
using BPG.Application.IServices;
using MediatR;

namespace BPG.Application.Features.Auth.Handlers;

    public class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResponse?>
    {
        private readonly IAuthService _authService;

        public LoginCommandHandler(IAuthService authService)
        {
            _authService = authService;
        }

        public async Task<LoginResponse?> Handle(
            LoginCommand request,
            CancellationToken cancellationToken)
        {
            return await _authService.LoginAsync(request.Email, request.Password);
        }
    }
