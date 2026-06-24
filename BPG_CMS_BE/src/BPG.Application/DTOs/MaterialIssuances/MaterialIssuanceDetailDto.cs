using System;
using System.Collections.Generic;

namespace BPG.Application.DTOs.MaterialIssuances
{
    public class MaterialIssuanceDetailDto
    {
        public long MaterialIssuanceId { get; set; }
        /// <summary>Mã phiếu xuất kho nghiệp vụ, ví dụ: PXK-20240624-A3F8B2</summary>
        public string IssuanceNo { get; set; } = string.Empty;
        public long TaskId { get; set; }
        public string TaskName { get; set; } = string.Empty;
        public string Purpose { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public List<MaterialIssuanceItemDto> Items { get; set; } = new List<MaterialIssuanceItemDto>();
    }
}
