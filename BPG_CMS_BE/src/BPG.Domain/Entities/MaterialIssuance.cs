namespace BPG.Domain.Entities;

public class MaterialIssuance : BaseEntity
{
    public long MaterialIssuanceId { get; set; }
    public long TaskId { get; set; }
    public string Purpose { get; set; } = string.Empty;

    public ProjectTask Task { get; set; } = null!;
    public ICollection<MaterialIssuanceItem> Items { get; set; } = new List<MaterialIssuanceItem>();
}
