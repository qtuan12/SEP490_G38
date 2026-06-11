namespace BPG.Domain.Entities;

public class SurplusRequest : BaseEntity
{
    public long SurplusRequestId { get; set; }
    public long ProjectId { get; set; }
    public string? Reason { get; set; }
    public string Status { get; set; } = "Draft";

    public Project Project { get; set; } = null!;
    public ICollection<SurplusRequestItem> Items { get; set; } = new List<SurplusRequestItem>();
}
