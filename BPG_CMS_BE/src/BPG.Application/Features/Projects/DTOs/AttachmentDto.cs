namespace BPG.Application.Features.Projects.DTOs;

public class AttachmentDto
{
    public long AttachmentId { get; set; }
    public string AttachmentType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public long? FileSizeBytes { get; set; }
}
