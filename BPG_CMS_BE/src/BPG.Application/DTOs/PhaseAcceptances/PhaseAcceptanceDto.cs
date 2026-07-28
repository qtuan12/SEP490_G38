namespace BPG.Application.DTOs.PhaseAcceptances;

public class PhaseAcceptanceDto
{
    public long AcceptanceId { get; set; }
    public long PhaseId { get; set; }
    public long ProjectId { get; set; }
    public string PhaseName { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public long AcceptedBy { get; set; }
    public string AcceptedByName { get; set; } = string.Empty;
    public DateTime AcceptanceDate { get; set; }
    public string ReportContent { get; set; } = string.Empty;
    public string? PdfUrl { get; set; }
    public bool IsCancelled { get; set; }
    public string? CancellationReason { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelledByName { get; set; }
}
