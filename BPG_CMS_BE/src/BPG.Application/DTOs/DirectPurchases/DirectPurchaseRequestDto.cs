namespace BPG.Application.DTOs.DirectPurchases
{
    public class DirectPurchaseRequestDto
    {
        public long DirectPurchaseId { get; set; }
        public string RequestNumber { get; set; } = string.Empty;
        public long ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;
        public string PhaseName { get; set; } = string.Empty;
        public string RequesterName { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public DateOnly PurchaseDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public string AuditStatus { get; set; } = string.Empty;
        public string BOQCheckStatus { get; set; } = string.Empty;
        public long RequestedBy { get; set; }
        public string? AuditNote { get; set; }
        public string? AuditorName { get; set; }
        public DateTime? AuditedAt { get; set; }
        public string? ApprovalNote { get; set; }
        public string? ApproverName { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public int ItemCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
