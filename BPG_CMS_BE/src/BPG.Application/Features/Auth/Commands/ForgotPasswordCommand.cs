using MediatR;

namespace BPG.Application.Features.Auth.Commands;

public record ForgotPasswordCommand(string Email) : IRequest;
