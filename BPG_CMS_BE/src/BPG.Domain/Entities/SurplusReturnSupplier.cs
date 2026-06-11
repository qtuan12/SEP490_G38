namespace BPG.Domain.Entities;

public class SurplusReturnSupplier : BaseEntity
{
    public long SurplusReturnSupplierId { get; set; }
    public long SurplusRequestItemId { get; set; }
    public long? SupplierId { get; set; }
    public decimal ReturnQuantity { get; set; }
    public decimal? RefundAmount { get; set; }
    public string? Note { get; set; }

    public SurplusRequestItem SurplusRequestItem { get; set; } = null!;
    public Supplier? Supplier { get; set; }
}
