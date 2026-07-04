using System;

namespace BPG.Application.DTOs.GoodsReceipts
{
    public class GoodsReceiptDto
    {
        public long ReceiptId { get; set; }
        public string ReceiptNo { get; set; } = string.Empty;
        public long POId { get; set; }
        public string PONumber { get; set; } = string.Empty;
        public string? DelivererInfo { get; set; }
        public string? DeliveryDocNo { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
    }
}
