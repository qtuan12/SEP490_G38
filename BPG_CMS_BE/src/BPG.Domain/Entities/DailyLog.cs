namespace BPG.Domain.Entities;

public class DailyLog
{
    public long LogId { get; set; }
    public long TaskId { get; set; }
    public DateOnly LogDate { get; set; }
    public byte NewProgressPercent { get; set; }
    public string Description { get; set; } = string.Empty;
    public long CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }

    // Audit: đánh dấu nhật ký đã bị chỉnh sửa (chỉ cho phép sửa trong 24h đầu)
    public bool IsEdited { get; set; } = false;
    public DateTime? LastEditedAt { get; set; }

    public ProjectTask Task { get; set; } = null!;
    public User Creator { get; set; } = null!;
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
}
