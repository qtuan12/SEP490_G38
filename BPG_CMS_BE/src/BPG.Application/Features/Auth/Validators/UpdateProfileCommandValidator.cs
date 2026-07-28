using System.Text.RegularExpressions;
using BPG.Application.Features.Auth.Commands;
using FluentValidation;

namespace BPG.Application.Features.Auth.Validators
{
    public class UpdateProfileCommandValidator : AbstractValidator<UpdateProfileCommand>
    {
        private static readonly Regex NamePattern = new(@"^[\p{L}\s]+$", RegexOptions.Compiled);
        private static readonly Regex PhonePattern = new(@"^(0[0-9]{9}|\+84[0-9]{9})$", RegexOptions.Compiled);

        public UpdateProfileCommandValidator()
        {
            RuleFor(x => x.FullName)
                .NotEmpty().WithMessage("Họ tên không được để trống.")
                .MinimumLength(2).WithMessage("Họ tên phải có ít nhất 2 ký tự.")
                .MaximumLength(100).WithMessage("Họ tên không được vượt quá 100 ký tự.")
                .Must(name => NamePattern.IsMatch(name.Trim()))
                .WithMessage("Họ tên chỉ được chứa chữ cái và khoảng trắng.")
                .When(x => !string.IsNullOrWhiteSpace(x.FullName));

            RuleFor(x => x.PhoneNumber)
                .Must(phone => PhonePattern.IsMatch(phone!.Replace(" ", "").Replace("-", "")))
                .WithMessage("Số điện thoại không hợp lệ. Ví dụ: 0912345678 hoặc +84912345678.")
                .When(x => !string.IsNullOrWhiteSpace(x.PhoneNumber));
        }
    }
}
