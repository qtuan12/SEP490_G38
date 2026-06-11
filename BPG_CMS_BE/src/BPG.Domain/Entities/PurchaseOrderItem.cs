namespace BPG.Domain.Entities;

public class PurchaseOrderItem
{
    public long POItemId { get; set; }
    public long POId { get; set; }
    public long MaterialId { get; set; }
    public int UnitId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
    public decimal ConversionRate { get; set; } = 1;

    public PurchaseOrder PurchaseOrder { get; set; } = null!;
    public MaterialCatalog Material { get; set; } = null!;
    public Unit Unit { get; set; } = null!;
}
