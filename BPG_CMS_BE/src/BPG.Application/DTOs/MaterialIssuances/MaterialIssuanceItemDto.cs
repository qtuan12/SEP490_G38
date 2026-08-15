namespace BPG.Application.DTOs.MaterialIssuances
{
    public class MaterialIssuanceItemDto
    {
        public long IssuanceItemId { get; set; }
        public long MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public int UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public bool IsDiscrete { get; set; }
        public decimal Quantity { get; set; }
        public decimal ConversionRate { get; set; }
    }
}
