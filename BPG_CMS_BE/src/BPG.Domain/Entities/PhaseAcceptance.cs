namespace BPG.Domain.Entities;

public class PhaseAcceptance : BaseEntity
{
    public long AcceptanceId { get; set; }
    public long PhaseId { get; set; }
    public long AcceptedBy { get; set; }
    public DateTime AcceptanceDate { get; set; }
    public string ReportContent { get; set; } = string.Empty;
    public string? PdfUrl { get; set; }
    public bool IsCancelled { get; set; } = false;
    public string? CancellationReason { get; set; }
    public DateTime? CancelledAt { get; set; }
    public long? CancelledBy { get; set; }

    public Phase Phase { get; set; } = null!;
    public User Acceptor { get; set; } = null!;
}
