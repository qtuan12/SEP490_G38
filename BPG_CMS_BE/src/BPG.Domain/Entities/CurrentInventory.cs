namespace BPG.Domain.Entities;

public class CurrentInventory
{
    public long InventoryId { get; set; }
    public long ProjectId { get; set; }
    public long MaterialId { get; set; }
    public int UnitId { get; set; }
    public decimal Quantity { get; set; }
    public decimal ReservedQuantity { get; set; } = 0;
    public DateTime LastUpdated { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public Project Project { get; set; } = null!;
    public MaterialCatalog Material { get; set; } = null!;
    public Unit Unit { get; set; } = null!;
}
