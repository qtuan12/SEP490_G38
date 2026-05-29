using BPG.Application.DTOs.Users;
using MediatR;

namespace BPG.Application.Features.Users.Commands
{
    public record ToggleUserStatusCommand(Guid Id) : IRequest<UserDto?>;
}
