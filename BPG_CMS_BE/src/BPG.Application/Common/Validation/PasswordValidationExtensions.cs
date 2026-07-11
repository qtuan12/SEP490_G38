using FluentValidation;

namespace BPG.Application.Common.Validation
{
    public static class PasswordValidationExtensions
    {
        /// <summary>
        /// Chính sách mật khẩu mạnh dùng chung cho đặt lại và đổi mật khẩu:
        /// 8-100 ký tự, không khoảng trắng, có chữ HOA, chữ thường, chữ số và ký tự đặc biệt.
        /// </summary>
        public static IRuleBuilderOptions<T, string> StrongPassword<T>(this IRuleBuilder<T, string> rule)
        {
            return rule
                .NotEmpty().WithMessage("Mật khẩu không được để trống.")
                .MinimumLength(8).WithMessage("Mật khẩu phải có ít nhất 8 ký tự.")
                .MaximumLength(100).WithMessage("Mật khẩu không được vượt quá 100 ký tự.")
                .Must(p => p != null && !p.Any(char.IsWhiteSpace)).WithMessage("Mật khẩu không được chứa khoảng trắng.")
                .Matches("[A-Z]").WithMessage("Mật khẩu phải có ít nhất 1 chữ in HOA.")
                .Matches("[a-z]").WithMessage("Mật khẩu phải có ít nhất 1 chữ thường.")
                .Matches("[0-9]").WithMessage("Mật khẩu phải có ít nhất 1 chữ số.")
                .Matches("[^a-zA-Z0-9]").WithMessage("Mật khẩu phải có ít nhất 1 ký tự đặc biệt (@, #, !, ...).");
        }
    }
}
