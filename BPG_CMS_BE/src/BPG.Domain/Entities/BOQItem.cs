namespace BPG.Domain.Entities;

public class BOQItem : BaseEntity
{
    public long BOQItemId { get; set; }
    public long PhaseId { get; set; }
    public long MaterialId { get; set; }
    public int UnitId { get; set; }
    public decimal Quantity { get; set; }
    public decimal ConversionRate { get; set; } = 1;

    public Phase Phase { get; set; } = null!;
    public MaterialCatalog Material { get; set; } = null!;
    public Unit Unit { get; set; } = null!;
}
