using System.Security.Cryptography;
using BPG.Application.Features.Auth.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Auth.Handlers;

public class VerifyOtpCommandHandler : IRequestHandler<VerifyOtpCommand, string>
{
    private const int MaxAttempts = 5;
    private const int ResetTokenExpiryMinutes = 15;

    private readonly IUnitOfWork _uow;
    private readonly IJwtService _jwtService;

    public VerifyOtpCommandHandler(IUnitOfWork uow, IJwtService jwtService)
    {
        _uow = uow;
        _jwtService = jwtService;
    }

    public async Task<string> Handle(VerifyOtpCommand request, CancellationToken ct)
    {
        var user = await _uow.Repository<User>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower() && !u.IsDeleted, ct)
            ?? throw new BusinessException(ErrorCodes.OtpEmailNotFound, "Email không hợp lệ.");

        var otpToken = await _uow.Repository<OtpToken>().Query()
            .Where(o => o.UserId == user.UserId
                     && o.OtpType == "FORGOT_PASSWORD"
                     && !o.IsUsed
                     && o.RevokedAt == null)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(ct)
            ?? throw new BusinessException(ErrorCodes.OtpNotFound, "Mã OTP không hợp lệ hoặc đã hết hạn.");

        if (otpToken.ExpiresAt < DateTime.UtcNow)
            throw new BusinessException(ErrorCodes.OtpExpired, "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.");

        if (otpToken.AttemptCount >= MaxAttempts)
            throw new BusinessException(ErrorCodes.OtpTooManyAttempts, "Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.");

        if (otpToken.Token != request.Otp)
        {
            otpToken.AttemptCount++;
            _uow.Repository<OtpToken>().Update(otpToken);
            await _uow.SaveChangesAsync(ct);

            var remaining = MaxAttempts - otpToken.AttemptCount;
            throw new BusinessException(ErrorCodes.OtpIncorrect, $"Mã OTP không đúng. Còn {remaining} lần thử.");
        }

        otpToken.IsUsed = true;
        _uow.Repository<OtpToken>().Update(otpToken);

        // Reset token đổi được mật khẩu nên đối xử như refresh token: sinh bằng nguồn ngẫu nhiên
        // mật mã (256 bit), trả giá trị thô cho client và chỉ LƯU BẢN BĂM. Ai đọc được bảng
        // OtpTokens cũng không dựng lại được token để chiếm tài khoản.
        var resetToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

        await _uow.Repository<OtpToken>().AddAsync(new OtpToken
        {
            UserId = user.UserId,
            OtpType = "PASSWORD_RESET",
            Token = _jwtService.HashToken(resetToken),
            ExpiresAt = DateTime.UtcNow.AddMinutes(ResetTokenExpiryMinutes),
            CreatedAt = DateTime.UtcNow
        }, ct);

        await _uow.SaveChangesAsync(ct);
        return resetToken;
    }
}
