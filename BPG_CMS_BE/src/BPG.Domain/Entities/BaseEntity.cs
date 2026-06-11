namespace BPG.Domain.Entities;

public abstract class BaseEntity
{
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public long? CreatedBy { get; set; }
    public long? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; } = false;
}
