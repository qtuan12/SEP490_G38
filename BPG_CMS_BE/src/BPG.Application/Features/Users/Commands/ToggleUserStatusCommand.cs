using BPG.Application.DTOs.Users;
using MediatR;

namespace BPG.Application.Features.Users.Commands
{
    public record ToggleUserStatusCommand(long Id) : IRequest<UserDto>;
}
