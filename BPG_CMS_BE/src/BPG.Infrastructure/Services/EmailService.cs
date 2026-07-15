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
        _logger.LogInformation("Bắt đầu gửi email đến {Recipient} | Tiêu đề: '{Subject}'", to, subject);

        var message = new MailMessage
        {
            From = new MailAddress(_config["Email:SenderEmail"]!, _config["Email:SenderName"]!),
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
        using var smtp = new SmtpClient(_config["Email:Host"]!, int.Parse(_config["Email:Port"]!))
        {
            Credentials = new NetworkCredential(_config["Email:SenderEmail"]!, _config["Email:Password"]!),
            EnableSsl = bool.Parse(_config["Email:EnableSsl"]!)
        };

        try
        {
            await smtp.SendMailAsync(message, ct);
            _logger.LogInformation("Gửi email thành công đến {Recipient}.", message.To[0].Address);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi xảy ra khi gửi email qua SMTP Host '{SmtpHost}' tới {Recipient}.", _config["Email:Host"], message.To[0].Address);
            throw;
        }
    }
}
