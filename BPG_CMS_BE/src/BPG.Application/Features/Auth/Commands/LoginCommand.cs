using BPG.Application.DTOs.Auth;
using MediatR;

namespace BPG.Application.Features.Auth.Commands
{
    public record LoginCommand(
        string Email,
        string Password
    ) : IRequest<LoginResponse>;
}
