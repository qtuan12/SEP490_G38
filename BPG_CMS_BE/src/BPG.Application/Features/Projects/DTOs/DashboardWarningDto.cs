namespace BPG.Application.Features.Projects.DTOs;

public class DashboardWarningDto
{
    public long ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public long TaskId { get; set; }
    public string? TaskName { get; set; }
    public string? WarningType { get; set; } // "Red", "Yellow", "Critical"
    public string? Message { get; set; }
}
