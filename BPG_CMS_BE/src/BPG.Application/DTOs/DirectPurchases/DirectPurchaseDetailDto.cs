namespace BPG.Application.DTOs.DirectPurchases
{
    public class DirectPurchaseDetailDto
    {
        public long DirectPurchaseId { get; set; }
        public string RequestNumber { get; set; } = string.Empty;
        public long ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;
        public long PhaseId { get; set; }
        public string PhaseName { get; set; } = string.Empty;
        public long RequestedBy { get; set; }
        public string RequesterName { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public DateOnly PurchaseDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public string AuditStatus { get; set; } = string.Empty;
        public string BOQCheckStatus { get; set; } = string.Empty;
        public DateTime? SubmittedAt { get; set; }
        public string? AuditNote { get; set; }
        public string? AuditorName { get; set; }
        public DateTime? AuditedAt { get; set; }
        public string? ApprovalNote { get; set; }
        public string? ApproverName { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? AutoPONumber { get; set; }
        public string? AutoReceiptNo { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<DirectPurchaseItemDetailDto> Items { get; set; } = new();
        public List<string> InvoicePhotoUrls { get; set; } = new();
    }

    public class DirectPurchaseItemDetailDto
    {
        public long MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public int UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal LineTotal { get; set; }
        public bool IsOverBOQ { get; set; }
        public string? Explanation { get; set; }
    }
}
