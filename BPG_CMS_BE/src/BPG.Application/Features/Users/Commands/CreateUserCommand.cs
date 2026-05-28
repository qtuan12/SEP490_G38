using BPG.Application.DTOs.Users;
using MediatR;

namespace BPG.Application.Features.Users.Commands
{
    public record CreateUserCommand(
        string Name,
        string Email,
        string Role
    ) : IRequest<UserDto>;
}
