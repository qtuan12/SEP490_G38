namespace BPG.Application.IServices;

public interface IEmailService
{
    Task SendAsync(string to, string subject, string body, CancellationToken ct = default);

    Task SendFromTemplateAsync(string to, string subject, string templateName,
        Dictionary<string, string> placeholders, CancellationToken ct = default);
}
