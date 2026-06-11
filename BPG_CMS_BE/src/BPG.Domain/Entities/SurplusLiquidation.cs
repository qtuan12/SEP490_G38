namespace BPG.Domain.Entities;

public class SurplusLiquidation : BaseEntity
{
    public long SurplusLiquidationId { get; set; }
    public long SurplusRequestItemId { get; set; }
    public string BuyerName { get; set; } = string.Empty;
    public decimal LiquidationQuantity { get; set; }
    public decimal TotalAmount { get; set; }

    public SurplusRequestItem SurplusRequestItem { get; set; } = null!;
}
