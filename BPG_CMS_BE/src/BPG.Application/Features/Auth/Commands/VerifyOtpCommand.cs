using MediatR;

namespace BPG.Application.Features.Auth.Commands;

public record VerifyOtpCommand(string Email, string Otp) : IRequest<string>;
