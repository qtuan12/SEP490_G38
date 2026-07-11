using BPG.Application.Common.Validation;
using BPG.Application.Features.Auth.Commands;
using FluentValidation;

namespace BPG.Application.Features.Auth.Validators
{
    public class ResetPasswordCommandValidator : AbstractValidator<ResetPasswordCommand>
    {
        public ResetPasswordCommandValidator()
        {
            RuleFor(x => x.ResetToken)
                .NotEmpty().WithMessage("Thiếu mã đặt lại mật khẩu.");

            RuleFor(x => x.NewPassword)
                .Cascade(CascadeMode.Stop)
                .StrongPassword();
        }
    }
}
