using BPG.Application.IServices;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.IO;
using System.Net;
using System.Net.Mail;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly string _templateRoot;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _config = config;
        _logger = logger;
        _templateRoot = Path.Combine(AppContext.BaseDirectory, "EmailTemplates");
    }

    public async Task SendAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        var senderEmail = _config["Email:SenderEmail"];
        var senderName = _config["Email:SenderName"] ?? "BPG Construction System";

        if (string.IsNullOrWhiteSpace(senderEmail))
        {
            _logger.LogWarning("Email:SenderEmail chưa được cấu hình trong appsettings.json. Bỏ qua gửi email đến {Recipient}.", to);
            return;
        }

        _logger.LogInformation("Bắt đầu gửi email đến {Recipient} | Tiêu đề: '{Subject}'", to, subject);

        var message = new MailMessage
        {
            From = new MailAddress(senderEmail, senderName),
            Subject = subject,
            Body = body,
            IsBodyHtml = true
        };
        message.To.Add(to);

        await SendMessageAsync(message, ct);
    }

    public async Task SendFromTemplateAsync(string to, string subject, string templateName,
        Dictionary<string, string> placeholders, CancellationToken ct = default)
    {
        _logger.LogInformation("Bắt đầu xử lý email từ template '{TemplateName}' đến {Recipient}", templateName, to);

        var templatePath = Path.Combine(_templateRoot, $"{templateName}.html");
        if (!File.Exists(templatePath))
        {
            _logger.LogError("Không tìm thấy file mẫu email tại đường dẫn '{TemplatePath}'", templatePath);
            throw new FileNotFoundException("Email template file not found.", templatePath);
        }

        var body = await File.ReadAllTextAsync(templatePath, ct);

        foreach (var (key, value) in placeholders)
            body = body.Replace($"{{{{{key}}}}}", value);

        await SendAsync(to, subject, body, ct);
    }

    private async Task SendMessageAsync(MailMessage message, CancellationToken ct)
    {
        var host = _config["Email:Host"];
        var portStr = _config["Email:Port"];
        var password = _config["Email:Password"];
        var enableSslStr = _config["Email:EnableSsl"];

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(password))
        {
            _logger.LogWarning("[DEV-MODE] Cấu hình SMTP (Email:Password) đang để trống. MÃ OTP / NỘI DUNG EMAIL gửi tới {Recipient}:\n----------------------------------------\n{Body}\n----------------------------------------", message.To[0].Address, message.Body);
            return;
        }

        int.TryParse(portStr, out var port);
        bool.TryParse(enableSslStr, out var enableSsl);

        using var smtp = new SmtpClient(host, port > 0 ? port : 587)
        {
            Credentials = new NetworkCredential(_config["Email:SenderEmail"]!, password),
            EnableSsl = enableSsl
        };

        try
        {
            await smtp.SendMailAsync(message, ct);
            _logger.LogInformation("Gửi email thành công đến {Recipient}.", message.To[0].Address);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi xảy ra khi gửi email qua SMTP Host '{SmtpHost}' tới {Recipient}.", host, message.To[0].Address);
            _logger.LogWarning("[DEV-MODE] Không thể gửi mail qua SMTP server. Đã ghi log nội dung email phục vụ kiểm thử.");
        }
    }
}
