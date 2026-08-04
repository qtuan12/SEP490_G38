using BPG.Application.Features.Auth.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Auth.Handlers;

public class ResetPasswordCommandHandler : IRequestHandler<ResetPasswordCommand>
{
    private readonly IUnitOfWork _uow;

    public ResetPasswordCommandHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task Handle(ResetPasswordCommand request, CancellationToken ct)
    {
        var resetToken = await _uow.Repository<OtpToken>().Query()
            .FirstOrDefaultAsync(o => o.Token == request.ResetToken
                                   && o.OtpType == "PASSWORD_RESET"
                                   && !o.IsUsed
                                   && o.RevokedAt == null, ct)
            ?? throw new BusinessException(ErrorCodes.ResetSessionInvalid, "Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");

        if (resetToken.ExpiresAt < DateTime.UtcNow)
            throw new BusinessException(ErrorCodes.ResetSessionInvalid, "Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thực hiện lại từ đầu.");

        var user = await _uow.Repository<User>().Query()
            .FirstOrDefaultAsync(u => u.UserId == resetToken.UserId && !u.IsDeleted, ct)
            ?? throw new BusinessException(ErrorCodes.ResetSessionInvalid, "Không tìm thấy tài khoản của phiên đặt lại mật khẩu này.");

        if (!string.IsNullOrEmpty(user.PasswordHash) &&
            BCrypt.Net.BCrypt.Verify(request.NewPassword, user.PasswordHash))
            throw new BusinessException(ErrorCodes.SamePassword, "Mật khẩu mới phải khác mật khẩu hiện tại.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.PasswordChangedAt = DateTime.UtcNow;
        user.FailedLoginCount = 0;
        user.LockedUntil = null;

        resetToken.IsUsed = true;

        _uow.Repository<User>().Update(user);
        _uow.Repository<OtpToken>().Update(resetToken);
        await _uow.SaveChangesAsync(ct);
    }
}
