using MediatR;

namespace BPG.Application.Features.Auth.Commands
{
    public record LogoutCommand(
        long UserId,
        string RefreshToken
    ) : IRequest;
}
