using BPG.Application.Features.Auth.Commands;
using BPG.Application.IRepositories;
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

    public VerifyOtpCommandHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<string> Handle(VerifyOtpCommand request, CancellationToken ct)
    {
        var user = await _uow.Repository<User>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower() && !u.IsDeleted, ct)
            ?? throw new BusinessException("AUTH_OTP", "Email không hợp lệ.");

        var otpToken = await _uow.Repository<OtpToken>().Query()
            .Where(o => o.UserId == user.UserId
                     && o.OtpType == "FORGOT_PASSWORD"
                     && !o.IsUsed
                     && o.RevokedAt == null)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(ct)
            ?? throw new BusinessException("AUTH_OTP", "Mã OTP không hợp lệ hoặc đã hết hạn.");

        if (otpToken.ExpiresAt < DateTime.UtcNow)
            throw new BusinessException("AUTH_OTP", "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.");

        if (otpToken.AttemptCount >= MaxAttempts)
            throw new BusinessException("AUTH_OTP", "Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.");

        if (otpToken.Token != request.Otp)
        {
            otpToken.AttemptCount++;
            _uow.Repository<OtpToken>().Update(otpToken);
            await _uow.SaveChangesAsync(ct);

            var remaining = MaxAttempts - otpToken.AttemptCount;
            throw new BusinessException("AUTH_OTP", $"Mã OTP không đúng. Còn {remaining} lần thử.");
        }

        otpToken.IsUsed = true;
        _uow.Repository<OtpToken>().Update(otpToken);

        var resetToken = Guid.NewGuid().ToString("N");
        await _uow.Repository<OtpToken>().AddAsync(new OtpToken
        {
            UserId = user.UserId,
            OtpType = "PASSWORD_RESET",
            Token = resetToken,
            ExpiresAt = DateTime.UtcNow.AddMinutes(ResetTokenExpiryMinutes),
            CreatedAt = DateTime.UtcNow
        }, ct);

        await _uow.SaveChangesAsync(ct);
        return resetToken;
    }
}
