namespace BPG.Domain.Entities;

public class MaterialRequest : BaseEntity
{
    public long RequestId { get; set; }
    public long PhaseId { get; set; }
    public long? CheckedBy { get; set; }
    public long? ApprovedBy { get; set; }
    public string BOQCheckStatus { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string? AccountantNote { get; set; }
    public string? ApprovalNote { get; set; }
    public string? ProcurementDecision { get; set; }
    public string Status { get; set; } = "Pending";

    public Phase Phase { get; set; } = null!;
    public User? Checker { get; set; }
    public User? Approver { get; set; }
    public ICollection<MaterialRequestItem> Items { get; set; } = new List<MaterialRequestItem>();
}
