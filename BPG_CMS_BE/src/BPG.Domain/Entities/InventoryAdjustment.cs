namespace BPG.Domain.Entities;

public class InventoryAdjustment : BaseEntity
{
    public long AdjustmentId { get; set; }
    public long ProjectId { get; set; }
    public long PhaseId { get; set; }
    public string AdjustmentType { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = "Draft";
    public long? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? RejectedReason { get; set; }

    public Project Project { get; set; } = null!;
    public Phase Phase { get; set; } = null!;
    public User? Approver { get; set; }
    public ICollection<AdjustmentItem> Items { get; set; } = new List<AdjustmentItem>();
}
