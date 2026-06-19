namespace BPG.Application.DTOs;

public class PhaseAcceptancePdfModel
{
    public string ProjectName { get; set; } = string.Empty;
    public string PhaseName { get; set; } = string.Empty;
    public string AcceptedByFullName { get; set; } = string.Empty;
    public DateTime AcceptanceDate { get; set; }
    public string ReportContent { get; set; } = string.Empty;
    public List<PhaseAcceptanceTaskDto> Tasks { get; set; } = new();
}

public class PhaseAcceptanceTaskDto
{
    public string TaskName { get; set; } = string.Empty;
    public string AssigneeName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public byte ProgressPercent { get; set; }
}
