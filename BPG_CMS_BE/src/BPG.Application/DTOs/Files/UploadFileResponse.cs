namespace BPG.Application.DTOs.Files
{
    public class UploadFileResponse
    {
        public string FileName { get; set; } = string.Empty;
        public string FileUrl { get; set; } = string.Empty;
        public string? ContentType { get; set; }
        public long FileSizeBytes { get; set; }
    }
}
