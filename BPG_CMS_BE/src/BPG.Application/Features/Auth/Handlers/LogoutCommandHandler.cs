using BPG.Application.Features.Auth.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Auth.Handlers
{
    public class LogoutCommandHandler : IRequestHandler<LogoutCommand>
    {
        private readonly IUnitOfWork _uow;
        private readonly IJwtService _jwtService;

        public LogoutCommandHandler(IUnitOfWork uow, IJwtService jwtService)
        {
            _uow = uow;
            _jwtService = jwtService;
        }

        public async Task Handle(LogoutCommand request, CancellationToken cancellationToken)
        {
            var tokenHash = _jwtService.HashToken(request.RefreshToken);

            var storedToken = await _uow.Repository<RefreshToken>().Query()
                .FirstOrDefaultAsync(rt => rt.UserId == request.UserId && rt.TokenHash == tokenHash, cancellationToken);

            if (storedToken == null || storedToken.RevokedAt.HasValue)
                return;

            storedToken.RevokedAt = DateTime.UtcNow;
            await _uow.SaveChangesAsync(cancellationToken);
        }
    }
}
