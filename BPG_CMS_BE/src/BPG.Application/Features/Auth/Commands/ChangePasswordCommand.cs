using MediatR;

namespace BPG.Application.Features.Auth.Commands
{
    public record ChangePasswordCommand(
        long UserId,
        string CurrentPassword,
        string NewPassword
    ) : IRequest;
}
