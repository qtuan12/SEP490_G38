namespace BPG.Application.DTOs.Phases;

public class PhaseBOQItemDto
{
    public long BOQItemId { get; set; }
    public long MaterialId { get; set; }
    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialName { get; set; } = string.Empty;
    public string? MaterialSpec { get; set; }
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public decimal BOQQuantity { get; set; }
    public decimal ConversionRate { get; set; }
    public decimal AlreadyConsumed { get; set; }
    public decimal RemainingQuantity { get; set; }
}
