namespace BPG.Application.Features.Wbs.DTOs;

public record WbsTaskDto
{
    public long TaskId { get; set; }
    public long PhaseId { get; set; }
    public long? ParentTaskId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int OrderIndex { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public byte ProgressPercent { get; set; }
    public bool IsLocked { get; set; }
    public string AssignedTo { get; set; } = string.Empty;
    public string AssignedName { get; set; } = string.Empty;
    public decimal? Weight { get; set; }
    public List<long> PredecessorTaskIds { get; set; } = new();
    
    public bool IsOverdue { get; set; }
    public bool IsAtRisk { get; set; }
    public int? DaysLeft { get; set; }

    public List<WbsTaskDto> SubTasks { get; set; } = new();
}

public record WbsPhaseDto
{
    public long PhaseId { get; set; }
    public long ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int OrderIndex { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public byte ProgressPercent { get; set; }
    
    public List<WbsTaskDto> Tasks { get; set; } = new();
    public List<PhaseMaterialItemDto> Materials { get; set; } = new();
}

public record PhaseMaterialItemDto
{
    public string Name { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
}

public record WbsTreeDto
{
    public long ProjectId { get; set; }
    public List<WbsPhaseDto> Phases { get; set; } = new();
}
