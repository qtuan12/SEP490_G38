using MediatR;

namespace BPG.Application.Features.Users.Commands
{
    public record DeleteUserCommand(long Id) : IRequest<bool>;
}
