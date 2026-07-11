namespace BPG.Application.DTOs.PurchaseOrders
{
    public class CreatePOItemDto
    {
        public long MaterialId { get; init; }
        public int UnitId { get; init; }
        public decimal Quantity { get; init; }
        public decimal UnitPrice { get; init; }
        public decimal ConversionRate { get; init; } = 1;
        public string? Notes { get; init; }
    }
}
