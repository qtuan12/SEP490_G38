using BPG.Application.DTOs.Auth;
using MediatR;

namespace BPG.Application.Features.Auth.Commands
{
    public record UpdateProfileCommand(
        long UserId,
        string FullName,
        string? PhoneNumber
    ) : IRequest<GetCurrentUserDto>;
}
