using System;

namespace BPG.Application.DTOs.DailyLogs
{
    public class CommentDto
    {
        public long CommentId { get; set; }
        public long LogId { get; set; }
        public long AuthorId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public string AuthorRole { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
