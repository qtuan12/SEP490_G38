namespace BPG.Domain.Entities;

public class Comment : BaseEntity
{
    public long CommentId { get; set; }
    public long LogId { get; set; }
    public long AuthorId { get; set; }
    public string Content { get; set; } = string.Empty;

    public DailyLog DailyLog { get; set; } = null!;
    public User Author { get; set; } = null!;
}
