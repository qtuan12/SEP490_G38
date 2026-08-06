using System;

namespace BPG.Application.DTOs.DailyLogs
{
    public class TaskProgressLogDto
    {
        public long TaskProgressLogId { get; set; }
        public long TaskId { get; set; }
        public byte OldProgress { get; set; }
        public byte NewProgress { get; set; }
        public string? UpdateReason { get; set; }
        public string Source { get; set; } = "Direct";
        public DateTime UpdatedAt { get; set; }
        public long? CreatedBy { get; set; }
        public string? UpdatedByName { get; set; }
    }
}
