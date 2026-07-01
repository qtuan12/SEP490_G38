namespace BPG.Domain.Entities;

public class PurchaseOrder : BaseEntity
{
    public long POId { get; set; }
    public long? RequestId { get; set; }          // nullable — tracked via PurchaseOrderRequests
    public long? SupplierId { get; set; }
    public long? ProjectId { get; set; }
    public string PONumber { get; set; } = string.Empty;
    public DateTime OrderDate { get; set; }
    public DateOnly? ExpectedDeliveryDate { get; set; }
    public string? DeliveryAddress { get; set; }
    public string? PaymentTerms { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = "Draft";
    public string? CancelledReason { get; set; }
    public decimal TotalAmount { get; set; }

    public MaterialRequest? Request { get; set; }
    public Supplier? Supplier { get; set; }
    public ICollection<PurchaseOrderItem> Items { get; set; } = new List<PurchaseOrderItem>();
    public ICollection<GoodsReceipt> GoodsReceipts { get; set; } = new List<GoodsReceipt>();
    public ICollection<PurchaseOrderRequest> RequestLinks { get; set; } = new List<PurchaseOrderRequest>();
}
