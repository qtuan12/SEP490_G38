using System;

namespace BPG.Application.DTOs.Units;

public class UnitDto
{
    public int UnitId { get; set; }
    public string UnitCode { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public bool IsDiscrete { get; set; }
}
