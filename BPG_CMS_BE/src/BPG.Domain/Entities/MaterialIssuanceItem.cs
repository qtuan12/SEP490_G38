namespace BPG.Domain.Entities;

public class MaterialIssuanceItem
{
    public long IssuanceItemId { get; set; }
    public long MaterialIssuanceId { get; set; }
    public long MaterialId { get; set; }
    public int UnitId { get; set; }
    public decimal Quantity { get; set; }
    public decimal ConversionRate { get; set; } = 1;

    public MaterialIssuance Issuance { get; set; } = null!;
    public MaterialCatalog Material { get; set; } = null!;
    public Unit Unit { get; set; } = null!;
}
