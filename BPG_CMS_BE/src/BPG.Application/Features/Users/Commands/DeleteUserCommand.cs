using MediatR;

namespace BPG.Application.Features.Users.Commands
{
    public record DeleteUserCommand(Guid Id) : IRequest<bool>;
}
