using BPG.Application.Features.Auth.Commands;
using BPG.Application.Features.Auth.Services;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Auth.Handlers;

public class ResetPasswordCommandHandler : IRequestHandler<ResetPasswordCommand>
{
    private readonly IUnitOfWork _uow;
    private readonly IJwtService _jwtService;

    public ResetPasswordCommandHandler(IUnitOfWork uow, IJwtService jwtService)
    {
        _uow = uow;
        _jwtService = jwtService;
    }

    public async Task Handle(ResetPasswordCommand request, CancellationToken ct)
    {
        // DB chỉ lưu bản băm của reset token nên phải băm giá trị client gửi lên rồi mới so.
        var tokenHash = _jwtService.HashToken(request.ResetToken ?? string.Empty);

        var resetToken = await _uow.Repository<OtpToken>().Query()
            .FirstOrDefaultAsync(o => o.Token == tokenHash
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

        // Đặt lại mật khẩu qua quên mật khẩu: cắt sạch phiên cũ, vì kịch bản điển hình là
        // tài khoản đã bị người khác chiếm.
        await RefreshTokenRevoker.RevokeAllAsync(_uow, user.UserId, ct);

        _uow.Repository<User>().Update(user);
        _uow.Repository<OtpToken>().Update(resetToken);
        await _uow.SaveChangesAsync(ct);
    }
}
