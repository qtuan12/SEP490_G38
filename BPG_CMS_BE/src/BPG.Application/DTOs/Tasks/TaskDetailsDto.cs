using System;
using System.Collections.Generic;

namespace BPG.Application.DTOs.Tasks;

public record TaskAssigneeDto(long UserId, string FullName, string Email);

public record TaskDailyLogDto(long DailyLogId, DateOnly LogDate, string Content, byte ProgressPercentAdded, List<string> ImageUrls);

public record TaskProgressLogDto(long LogId, byte OldProgress, byte NewProgress, string? UpdateReason, DateTime UpdatedAt);

public record TaskDetailsDto
{
    public long TaskId { get; set; }
    public long PhaseId { get; set; }
    public long? ParentTaskId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public byte ProgressPercent { get; set; }
    public string? ObsoleteReason { get; set; }

    public List<TaskAssigneeDto> Assignees { get; set; } = new();
    public List<TaskDailyLogDto> DailyLogs { get; set; } = new();
    public List<TaskProgressLogDto> ProgressLogs { get; set; } = new();
}
