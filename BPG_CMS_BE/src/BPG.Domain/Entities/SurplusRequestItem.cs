namespace BPG.Domain.Entities;

public class SurplusRequestItem : BaseEntity
{
    public long SurplusRequestItemId { get; set; }
    public long SurplusRequestId { get; set; }
    public long MaterialId { get; set; }
    public int UnitId { get; set; }
    public decimal Quantity { get; set; }
    public decimal ProcessedQuantity { get; set; } = 0;
    public decimal ConversionRate { get; set; } = 1;
    public string Status { get; set; } = "Pending";

    public SurplusRequest SurplusRequest { get; set; } = null!;
    public MaterialCatalog Material { get; set; } = null!;
    public Unit Unit { get; set; } = null!;
    public ICollection<SurplusReturnSupplier> ReturnToSuppliers { get; set; } = new List<SurplusReturnSupplier>();
    public ICollection<SurplusTransfer> Transfers { get; set; } = new List<SurplusTransfer>();
    public ICollection<SurplusLiquidation> Liquidations { get; set; } = new List<SurplusLiquidation>();
}
