namespace BPG.Domain.Entities;

public class DirectPurchaseRequest : BaseEntity
{
    public long DirectPurchaseId { get; set; }
    public long ProjectId { get; set; }
    public long PhaseId { get; set; }
    public long? TaskId { get; set; }
    public long RequestedBy { get; set; }
    public long? AutoPOId { get; set; }
    public long? AutoReceiptId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = "Draft";
    public string AuditStatus { get; set; } = "PendingAudit";
    public decimal TotalAmount { get; set; }
    public DateTime PurchaseDate { get; set; }
    public long? AuditedBy { get; set; }
    public DateTime? AuditedAt { get; set; }
    public string? AuditNote { get; set; }

    public Project Project { get; set; } = null!;
    public Phase Phase { get; set; } = null!;
    public ProjectTask? Task { get; set; }
    public User Requester { get; set; } = null!;
    public User? Auditor { get; set; }
    public ICollection<DirectPurchaseItem> Items { get; set; } = new List<DirectPurchaseItem>();
}
