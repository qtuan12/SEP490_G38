using BPG.Application.Features.Auth.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Auth.Handlers;

public class ForgotPasswordCommandHandler : IRequestHandler<ForgotPasswordCommand>
{
    private const int OtpExpiryMinutes = 10;

    private readonly IUnitOfWork _uow;
    private readonly IEmailService _emailService;

    public ForgotPasswordCommandHandler(IUnitOfWork uow, IEmailService emailService)
    {
        _uow = uow;
        _emailService = emailService;
    }

    public async Task Handle(ForgotPasswordCommand request, CancellationToken ct)
    {
        var user = await _uow.Repository<User>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower() && !u.IsDeleted, ct);

        // Không tiết lộ email có tồn tại hay không
        if (user == null) return;

        // Thu hồi các OTP cũ chưa dùng
        var oldTokens = await _uow.Repository<OtpToken>().Query()
            .Where(o => o.UserId == user.UserId && o.OtpType == "FORGOT_PASSWORD" && !o.IsUsed)
            .ToListAsync(ct);

        foreach (var old in oldTokens)
        {
            old.IsUsed = true;
            old.RevokedAt = DateTime.UtcNow;
            _uow.Repository<OtpToken>().Update(old);
        }

        var otp = Random.Shared.Next(100000, 999999).ToString();

        await _uow.Repository<OtpToken>().AddAsync(new OtpToken
        {
            UserId = user.UserId,
            OtpType = "FORGOT_PASSWORD",
            Token = otp,
            ExpiresAt = DateTime.UtcNow.AddMinutes(OtpExpiryMinutes),
            CreatedAt = DateTime.UtcNow
        }, ct);

        await _uow.SaveChangesAsync(ct);

        await _emailService.SendFromTemplateAsync(
            user.Email,
            "Mã OTP đặt lại mật khẩu - BPG Construction",
            "ForgotPassword",
            new Dictionary<string, string>
            {
                { "FullName", user.FullName },
                { "OtpCode", otp },
                { "ExpiryMinutes", OtpExpiryMinutes.ToString() }
            },
            ct);
    }
}
