namespace BPG.Application.Features.Surplus.DTOs;

public class IncomingSurplusTransferDto : SurplusTransferDto
{
    public long MaterialId { get; set; }
    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialName { get; set; } = string.Empty;
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
}
