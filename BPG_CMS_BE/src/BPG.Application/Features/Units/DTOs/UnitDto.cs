using System;

namespace BPG.Application.Features.Units.DTOs;

public class UnitDto
{
    public int UnitId { get; set; }
    public string UnitCode { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public bool IsDiscrete { get; set; }
}
