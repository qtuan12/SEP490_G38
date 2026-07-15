namespace BPG.Application.Features.Units.DTOs;

public class UpdateUnitRequest
{
    public string UnitCode { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public bool IsDiscrete { get; set; }
}
