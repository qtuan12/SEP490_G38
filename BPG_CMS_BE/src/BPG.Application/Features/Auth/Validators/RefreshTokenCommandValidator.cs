using BPG.Application.Features.Auth.Commands;
using FluentValidation;

namespace BPG.Application.Features.Auth.Validators
{
    public class RefreshTokenCommandValidator : AbstractValidator<RefreshTokenCommand>
    {
        public RefreshTokenCommandValidator()
        {
            RuleFor(x => x.RefreshToken)
                .NotEmpty().WithMessage("Vui lòng cung cấp refresh token.");
        }
    }
}
