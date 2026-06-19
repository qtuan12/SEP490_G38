using MediatR;

namespace BPG.Application.Features.Auth.Commands;

public record ResetPasswordCommand(string ResetToken, string NewPassword) : IRequest;
