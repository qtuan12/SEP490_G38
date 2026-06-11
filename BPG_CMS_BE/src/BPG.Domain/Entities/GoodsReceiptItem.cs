namespace BPG.Domain.Entities;

public class GoodsReceiptItem
{
    public long ReceiptItemId { get; set; }
    public long ReceiptId { get; set; }
    public long MaterialId { get; set; }
    public int UnitId { get; set; }
    public decimal Quantity { get; set; }
    public decimal ConversionRate { get; set; } = 1;

    public GoodsReceipt Receipt { get; set; } = null!;
    public MaterialCatalog Material { get; set; } = null!;
    public Unit Unit { get; set; } = null!;
}
