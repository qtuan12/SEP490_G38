using System;
using System.Collections.Generic;
using BPG.Domain.Constants;

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
        public string CreatorRole { get; set; } = string.Empty;
        public string Source { get; set; } = DailyLogSource.Manual;
        public DateOnly LogDate { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsEdited { get; set; }
        public DateTime? LastEditedAt { get; set; }

        // Cờ chỉ báo phía FE có được phép chỉnh sửa nhật ký hay không
        // (trong cửa sổ chỉnh sửa cấu hình bới Quản trị viên).
        public bool CanEdit { get; set; }

        // Số giờ cấu hình được phép chỉnh sửa (DailyLogEditWindowHours), dùng phía FE ước tính.
        public int EditWindowHours { get; set; }
        public List<string> Images { get; set; } = new List<string>();
        public List<CommentDto> Comments { get; set; } = new List<CommentDto>();
    }
}
