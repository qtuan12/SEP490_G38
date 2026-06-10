namespace BPG.Domain.Entities;

public class InventoryTransaction
{
    public long TransactionId { get; set; }
    public long ProjectId { get; set; }
    public long MaterialId { get; set; }
    public byte TransactionType { get; set; }
    public long ReferenceId { get; set; }
    public decimal QuantityChange { get; set; }
    public decimal BalanceAfter { get; set; }
    public long? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }

    public Project Project { get; set; } = null!;
    public MaterialCatalog Material { get; set; } = null!;
}
