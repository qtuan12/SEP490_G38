using BPG.Application.DTOs.Auth;
using MediatR;

namespace BPG.Application.Features.Auth.Commands
{
    public record RefreshTokenCommand(
        string RefreshToken
    ) : IRequest<RefreshTokenResponse>;
}
