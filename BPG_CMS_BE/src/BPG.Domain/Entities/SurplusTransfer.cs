namespace BPG.Domain.Entities;

public class SurplusTransfer : BaseEntity
{
    public long SurplusTransferId { get; set; }
    public long SurplusRequestItemId { get; set; }
    public long FromProjectId { get; set; }
    public long ToProjectId { get; set; }
    public decimal TransferQuantity { get; set; }
    public string Status { get; set; } = "Pending";
    public long? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public long? DispatchedBy { get; set; }
    public DateTime? DispatchedAt { get; set; }
    public long? ReceivedBy { get; set; }
    public DateTime? ReceivedAt { get; set; }

    public SurplusRequestItem SurplusRequestItem { get; set; } = null!;
    public Project FromProject { get; set; } = null!;
    public Project ToProject { get; set; } = null!;
    public User? Approver { get; set; }
    public User? Dispatcher { get; set; }
    public User? Receiver { get; set; }
}
