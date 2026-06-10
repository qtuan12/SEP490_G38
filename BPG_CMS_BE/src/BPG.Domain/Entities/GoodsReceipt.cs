namespace BPG.Domain.Entities;

public class GoodsReceipt : BaseEntity
{
    public long ReceiptId { get; set; }
    public string ReceiptNo { get; set; } = string.Empty;
    public long POId { get; set; }
    public string? DelivererInfo { get; set; }
    public string? DeliveryDocNo { get; set; }
    public string Status { get; set; } = "Draft";

    public PurchaseOrder PurchaseOrder { get; set; } = null!;
    public ICollection<GoodsReceiptItem> Items { get; set; } = new List<GoodsReceiptItem>();
}
