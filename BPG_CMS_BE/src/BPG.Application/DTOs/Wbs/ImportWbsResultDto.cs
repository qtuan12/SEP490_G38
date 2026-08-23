using System.Collections.Generic;

namespace BPG.Application.DTOs.Wbs;

public class ImportWbsResultDto
{
    public int PhaseCount { get; set; }
    public int TaskCount { get; set; }
    public int SkippedCount { get; set; }
    public List<string> Errors { get; set; } = new();
}
