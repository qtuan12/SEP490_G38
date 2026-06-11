namespace BPG.Domain.Entities;

public class MaterialRequestItem
{
    public long RequestItemId { get; set; }
    public long RequestId { get; set; }
    public long MaterialId { get; set; }
    public int UnitId { get; set; }
    public decimal Quantity { get; set; }
    public decimal ConversionRate { get; set; } = 1;
    public bool IsOverBOQ { get; set; } = false;
    public string? Explanation { get; set; }

    public MaterialRequest Request { get; set; } = null!;
    public MaterialCatalog Material { get; set; } = null!;
    public Unit Unit { get; set; } = null!;
}
