using BPG.Application.Features.Auth.Commands;
using FluentValidation;

namespace BPG.Application.Features.Auth.Validators
{
    /// <summary>
    /// Chỉ kiểm định dạng chuỗi, không tra cứu database — giữ nguyên nguyên tắc không tiết lộ
    /// email nào đang tồn tại trong hệ thống của luồng quên mật khẩu.
    /// Mục đích: người gõ nhầm email được báo ngay, thay vì bị chuyển sang màn nhập OTP
    /// rồi ngồi chờ một mã không bao giờ được gửi.
    /// </summary>
    public class ForgotPasswordCommandValidator : AbstractValidator<ForgotPasswordCommand>
    {
        public ForgotPasswordCommandValidator()
        {
            RuleFor(x => x.Email)
                .Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("Vui lòng nhập email tài khoản.")
                .EmailAddress().WithMessage("Email không đúng định dạng.")
                .MaximumLength(255).WithMessage("Email không được vượt quá 255 ký tự.");
        }
    }
}
