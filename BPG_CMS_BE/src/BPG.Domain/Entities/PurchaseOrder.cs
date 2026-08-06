namespace BPG.Domain.Entities;

public class PurchaseOrder : BaseEntity
{
    public long POId { get; set; }
    public long? RequestId { get; set; }
    public long? SupplierId { get; set; }
    public long ProjectId { get; set; }
    public string PONumber { get; set; } = string.Empty;
    public DateTime OrderDate { get; set; }
    public DateOnly? ExpectedDeliveryDate { get; set; }
    public string? DeliveryAddress { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = "Draft";
    public string? CancelledReason { get; set; }
    public string? ClosedReason { get; set; }
    public decimal TotalAmount { get; set; }

    // ---- Duyệt đơn hàng: mọi PO đều phải qua Giám đốc trước khi gửi nhà cung cấp ----
    public long? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    /// <summary>Ghi chú của Giám đốc khi duyệt.</summary>
    public string? ApprovalNote { get; set; }
    /// <summary>Lý do Giám đốc từ chối đơn hàng.</summary>
    public string? RejectedReason { get; set; }

    public MaterialRequest? Request { get; set; }
    public User? Approver { get; set; }
    public Supplier? Supplier { get; set; }
    public Project Project { get; set; } = null!;
    public ICollection<PurchaseOrderItem> Items { get; set; } = new List<PurchaseOrderItem>();
    public ICollection<GoodsReceipt> GoodsReceipts { get; set; } = new List<GoodsReceipt>();
}
