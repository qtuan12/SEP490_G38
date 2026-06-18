using BPG.Application.IServices;
using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Mail;

namespace BPG.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly string _templateRoot;

    public EmailService(IConfiguration config)
    {
        _config = config;
        // Templates nằm cùng assembly Infrastructure
        _templateRoot = Path.Combine(AppContext.BaseDirectory, "EmailTemplates");
    }

    public async Task SendAsync(string to, string subject, string body, CancellationToken ct = default)
    {
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
        var templatePath = Path.Combine(_templateRoot, $"{templateName}.html");
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

        await smtp.SendMailAsync(message, ct);
    }
}
