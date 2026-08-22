using System.Text;
using System.Text.RegularExpressions;
using BPG.Application.Features.Users.Commands;
using FluentValidation;

namespace BPG.Application.Features.Users.Validators
{
    public class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand>
    {
        private static readonly Regex NamePattern = new(@"^[\p{L}\s0-9.'-]+$", RegexOptions.Compiled);
        private static readonly Regex PhonePattern = new(@"^(0[0-9]{9}|\+84[0-9]{9})$", RegexOptions.Compiled);

        public UpdateUserCommandValidator()
        {
            RuleFor(x => x.Name)
                .MinimumLength(2).WithMessage("Họ tên phải có ít nhất 2 ký tự.")
                .MaximumLength(100).WithMessage("Họ tên không được vượt quá 100 ký tự.")
                // Chuẩn hóa NFC trước khi so regex: một số IME/hệ điều hành gõ chữ Việt có dấu
                // ở dạng NFD (chữ cái + dấu ghép rời), khiến \p{L} không khớp dấu.
                .Must(name => NamePattern.IsMatch(name!.Trim().Normalize(NormalizationForm.FormC)))
                .WithMessage("Họ tên chỉ được chứa chữ cái, số, khoảng trắng và các ký tự - . '")
                .When(x => !string.IsNullOrWhiteSpace(x.Name));

            RuleFor(x => x.Email)
                .EmailAddress().WithMessage("Email không đúng định dạng.")
                .MaximumLength(255).WithMessage("Email không được vượt quá 255 ký tự.")
                .When(x => !string.IsNullOrWhiteSpace(x.Email));

            RuleFor(x => x.PhoneNumber)
                .Must(phone => PhonePattern.IsMatch(Regex.Replace(phone!, @"[\s.()-]", "")))
                .WithMessage("Số điện thoại không hợp lệ. Ví dụ: 0912345678 hoặc +84912345678.")
                .When(x => !string.IsNullOrWhiteSpace(x.PhoneNumber));
        }
    }
}
