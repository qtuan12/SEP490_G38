namespace BPG.Domain.Entities;

public class MaterialConversion : BaseEntity
{
    public long MaterialId { get; set; }
    public int AlternativeUnitId { get; set; }
    public decimal ConversionRate { get; set; }

    public MaterialCatalog Material { get; set; } = null!;
    public Unit AlternativeUnit { get; set; } = null!;
}
