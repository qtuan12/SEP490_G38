namespace BPG.Application.DTOs.PurchaseOrders
{
    public class PurchaseOrderDetailDto
    {
        public long POId { get; set; }
        public string PONumber { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateOnly OrderDate { get; set; }
        public DateOnly? ExpectedDeliveryDate { get; set; }
        public string? DeliveryAddress { get; set; }
        public string? Notes { get; set; }
        public string? CancelledReason { get; set; }
        public string? ClosedReason { get; set; }
        public decimal TotalAmount { get; set; }

        // Thông tin duyệt của Giám đốc
        public string? ApproverName { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? ApprovalNote { get; set; }
        public string? RejectedReason { get; set; }

        public long? SupplierId { get; set; }
        public string SupplierName { get; set; } = string.Empty;
        public string? SupplierContactInfo { get; set; }

        public long ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;

        public List<PODetailItemDto> Items { get; set; } = new();
        public List<LinkedRequestDto> LinkedRequests { get; set; } = new();

        /// <summary>Ảnh/PDF báo giá nhà cung cấp đính kèm khi tạo đơn.</summary>
        public List<POQuotationDto> QuotationFiles { get; set; } = new();
    }

    public class PODetailItemDto
    {
        public long POItemId { get; set; }
        public long MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public string Specification { get; set; } = string.Empty;
        public int UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal LineTotal { get; set; }
        public decimal ConversionRate { get; set; }
        public decimal TotalReceived { get; set; }
        public string? Notes { get; set; }
    }

    public class POQuotationDto
    {
        public long AttachmentId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string FileUrl { get; set; } = string.Empty;
        public string? ContentType { get; set; }
        public long? FileSizeBytes { get; set; }
    }

    public class LinkedRequestDto
    {
        public long RequestId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public long ProjectId { get; set; }
        public long PhaseId { get; set; }
        public string PhaseName { get; set; } = string.Empty;
    }
}
