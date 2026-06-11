namespace BPG.Domain.Entities;

public class MaterialCatalog : BaseEntity
{
    public long MaterialId { get; set; }
    public long CategoryId { get; set; }
    public int BaseUnitId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Specification { get; set; }

    public MaterialCategory Category { get; set; } = null!;
    public Unit BaseUnit { get; set; } = null!;
    public ICollection<MaterialConversion> Conversions { get; set; } = new List<MaterialConversion>();
    public ICollection<BOQItem> BOQItems { get; set; } = new List<BOQItem>();
}
