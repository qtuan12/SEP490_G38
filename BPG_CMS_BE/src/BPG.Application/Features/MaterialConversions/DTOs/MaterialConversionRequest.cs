namespace BPG.Application.Features.MaterialConversions.DTOs;

public class MaterialConversionRequest
{
    public int AlternativeUnitId { get; set; }
    public decimal ConversionRate { get; set; }
}
