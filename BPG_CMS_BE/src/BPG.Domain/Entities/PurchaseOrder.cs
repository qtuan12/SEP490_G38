namespace BPG.Domain.Entities;

public class PurchaseOrder : BaseEntity
{
    public long POId { get; set; }
    public long RequestId { get; set; }
    public long? SupplierId { get; set; }
    public string PONumber { get; set; } = string.Empty;
    public DateTime OrderDate { get; set; }
    public DateOnly? ExpectedDeliveryDate { get; set; }
    public string Status { get; set; } = "Draft";
    public decimal TotalAmount { get; set; }

    public MaterialRequest Request { get; set; } = null!;
    public Supplier? Supplier { get; set; }
    public ICollection<PurchaseOrderItem> Items { get; set; } = new List<PurchaseOrderItem>();
    public ICollection<GoodsReceipt> GoodsReceipts { get; set; } = new List<GoodsReceipt>();
}
