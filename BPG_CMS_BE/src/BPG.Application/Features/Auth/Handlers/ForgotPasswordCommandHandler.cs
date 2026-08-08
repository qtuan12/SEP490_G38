using System.Security.Cryptography;
using BPG.Application.Features.Auth.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
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

        // Báo thẳng email không tồn tại thay vì im lặng: người dùng gõ nhầm email sẽ đứng chờ mã
        // OTP không bao giờ tới mà không hiểu vì sao. Đổi lại, ai cũng dò được email nào là tài
        // khoản của hệ thống — chấp nhận vì đây là hệ nội bộ, không cho tự đăng ký.
        if (user == null)
            throw new NotFoundException("Email không tồn tại trong hệ thống.");

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

        // Bắt buộc dùng nguồn ngẫu nhiên mật mã: Random là PRNG tất định, quan sát vài mã là suy
        // ra được trạng thái bộ sinh rồi đoán mã của người khác — mà mã này đổi được mật khẩu.
        // Cận trên của GetInt32 là loại trừ nên dùng 1000000 để phủ hết dải 100000-999999.
        var otp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

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
