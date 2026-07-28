namespace BPG.Application.DTOs.MaterialConversions;

public class MaterialConversionDto
{
    public long MaterialId { get; set; }
    public int AlternativeUnitId { get; set; }
    public string AlternativeUnitName { get; set; } = string.Empty;
    public decimal ConversionRate { get; set; }
}
