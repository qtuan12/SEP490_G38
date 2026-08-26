using System;
using System.Collections.Generic;

namespace BPG.Application.DTOs.Wbs;

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
    public DateOnly? ActualStartDate { get; set; }
    public DateOnly? ActualEndDate { get; set; }
    public List<long> PredecessorTaskIds { get; set; } = new();
    
    public bool IsOverdue { get; set; }
    public bool IsAtRisk { get; set; }
    public int? DaysLeft { get; set; }

    public bool IsOutsourced { get; set; }
    public string? OutsourcedTeamName { get; set; }
    public string? OutsourcedTeamContact { get; set; }
    public string? ObsoleteReason { get; set; }

    public List<WbsTaskDto> SubTasks { get; set; } = new();
}

public record WbsBOQItemDto(string Name, decimal Quantity, string Unit);

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

    /// <summary>Ngày bắt đầu thực tế: MIN(ActualStartDate của các task trong phase)</summary>
    public DateOnly? ActualStartDate { get; set; }

    /// <summary>
    /// Ngày kết thúc thực tế:
    /// - Chỉ có giá trị khi phase đã được nghiệm thu: lấy PhaseAcceptance.AcceptanceDate
    /// </summary>
    public DateOnly? ActualEndDate { get; set; }

    public List<WbsBOQItemDto> BOQItems { get; set; } = new();
    public List<WbsTaskDto> Tasks { get; set; } = new();
    public List<PhaseMaterialItemDto> Materials { get; set; } = new();
}

public record PhaseMaterialItemDto
{
    public long MaterialId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public int UnitId { get; set; }
    public string Unit { get; set; } = string.Empty;
    public decimal ConversionRate { get; set; } = 1.0m;
}

public record WbsTreeDto
{
    public long ProjectId { get; set; }
    public List<WbsPhaseDto> Phases { get; set; } = new();
}
