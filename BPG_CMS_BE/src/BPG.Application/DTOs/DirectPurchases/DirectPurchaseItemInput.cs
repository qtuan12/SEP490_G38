namespace BPG.Application.DTOs.DirectPurchases
{
    public class DirectPurchaseItemInput
    {
        public long MaterialId { get; set; }
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
    }
}
