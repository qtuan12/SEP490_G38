using System;
using System.Collections.Generic;

namespace BPG.Application.DTOs.DailyLogs
{
    public class DailyLogDto
    {
        public long LogId { get; set; }
        public long TaskId { get; set; }
        public string TaskName { get; set; } = string.Empty;
        public byte OldProgressPercent { get; set; }
        public byte NewProgressPercent { get; set; }
        public string Description { get; set; } = string.Empty;
        public long CreatedBy { get; set; }
        public string CreatorName { get; set; } = string.Empty;
        public DateOnly LogDate { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<string> Images { get; set; } = new List<string>();
        public List<CommentDto> Comments { get; set; } = new List<CommentDto>();
    }
}
