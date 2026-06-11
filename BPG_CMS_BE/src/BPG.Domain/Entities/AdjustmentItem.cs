namespace BPG.Domain.Entities;

public class AdjustmentItem
{
    public long AdjustmentItemId { get; set; }
    public long AdjustmentId { get; set; }
    public long MaterialId { get; set; }
    public int UnitId { get; set; }
    public decimal Quantity { get; set; }
    public decimal ConversionRate { get; set; } = 1;

    public InventoryAdjustment Adjustment { get; set; } = null!;
    public MaterialCatalog Material { get; set; } = null!;
    public Unit Unit { get; set; } = null!;
}
