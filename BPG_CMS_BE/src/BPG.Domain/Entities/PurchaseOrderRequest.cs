namespace BPG.Domain.Entities;

public class PurchaseOrderRequest
{
    public long POId { get; set; }
    public long RequestId { get; set; }

    public PurchaseOrder PurchaseOrder { get; set; } = null!;
    public MaterialRequest MaterialRequest { get; set; } = null!;
}
