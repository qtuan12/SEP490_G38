using System;
using System.Collections.Generic;

namespace BPG.Application.DTOs.Wbs;

public class PreviewWbsImportResultDto
{
    public int PhaseCount { get; set; }
    public int TaskCount { get; set; }
    public int SkippedCount { get; set; }
    public List<string> Errors { get; set; } = new();
    public List<PreviewWbsPhaseDto> Phases { get; set; } = new();
}

public class PreviewWbsPhaseDto
{
    public string WbsCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public List<PreviewWbsTaskDto> Tasks { get; set; } = new();
}

public class PreviewWbsTaskDto
{
    public string WbsCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal? Weight { get; set; }
    public bool IsOutsourced { get; set; }
    public string? OutsourcedTeamName { get; set; }
    public List<string> Assignees { get; set; } = new();
    public List<string> Predecessors { get; set; } = new();
    public List<PreviewWbsTaskDto> SubTasks { get; set; } = new();
}
