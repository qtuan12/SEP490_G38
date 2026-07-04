using System;
using System.Collections.Generic;

namespace BPG.Application.DTOs.MaterialRequests
{
    public class MaterialRequestDto
    {
        public long RequestId { get; set; }
        public long PhaseId { get; set; }
        public long ProjectId { get; set; }
        public string PhaseName { get; set; } = string.Empty;
        public long? CheckedBy { get; set; }
        public string? CheckedByName { get; set; }
        public long? ApprovedBy { get; set; }
        public string? ApprovedByName { get; set; }
        public string BOQCheckStatus { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public string? AccountantNote { get; set; }
        public string? ApprovalNote { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public long? CreatedBy { get; set; }
        public string? CreatedByName { get; set; }
        public List<MaterialRequestItemDto> Items { get; set; } = new();
    }

    public class MaterialRequestItemDto
    {
        public long RequestItemId { get; set; }
        public long MaterialId { get; set; }
        public string MaterialName { get; set; } = string.Empty;
        public string MaterialCode { get; set; } = string.Empty;
        public int UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal ConversionRate { get; set; }
        public bool IsOverBOQ { get; set; }
        public string? Explanation { get; set; }
    }
}
