using System;
using System.Collections.Generic;

namespace BPG.Application.DTOs.Inventory
{
    public class InventoryAdjustmentDto
    {
        public long AdjustmentId { get; set; }
        public long ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;
        public long PhaseId { get; set; }
        public string PhaseName { get; set; } = string.Empty;
        public long? IncidentId { get; set; }
        public string AdjustmentType { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Status { get; set; } = string.Empty;
        
        public long? CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        
        public long? ApprovedBy { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? RejectedReason { get; set; }
        
        public string CreatorName { get; set; } = string.Empty;
        public string ApproverName { get; set; } = string.Empty;

        public List<AdjustmentItemDto> Items { get; set; } = new List<AdjustmentItemDto>();
    }
}
