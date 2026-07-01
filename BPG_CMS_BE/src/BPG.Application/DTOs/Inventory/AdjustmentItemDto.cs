using System;

namespace BPG.Application.DTOs.Inventory
{
    public class AdjustmentItemDto
    {
        public long AdjustmentItemId { get; set; }
        public long AdjustmentId { get; set; }
        public long MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public string Specification { get; set; } = string.Empty;
        public int UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal ConversionRate { get; set; }
    }
}
