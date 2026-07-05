using System;
using System.Collections.Generic;

namespace BPG.Application.DTOs.MaterialReturns
{
    /// <summary>
    /// DTO tóm tắt cho danh sách phiếu hoàn trả (dùng trong bảng phân trang).
    /// </summary>
    public class MaterialReturnDto
    {
        public long MaterialReturnId { get; set; }
        /// <summary>Mã phiếu hoàn trả, ví dụ: PTra-20240630-A3F8B2</summary>
        public string ReturnNo { get; set; } = string.Empty;
        public long OriginalIssuanceId { get; set; }
        /// <summary>Mã phiếu xuất kho gốc, ví dụ: PXK-20240628-D4C1A0</summary>
        public string OriginalIssuanceNo { get; set; } = string.Empty;
        public long TaskId { get; set; }
        public string TaskName { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public int TotalItems { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public List<MaterialReturnItemDto> Items { get; set; } = new();
    }

    /// <summary>
    /// DTO chi tiết phiếu hoàn trả, kèm danh sách vật tư.
    /// </summary>
    public class MaterialReturnDetailDto
    {
        public long MaterialReturnId { get; set; }
        public string ReturnNo { get; set; } = string.Empty;
        public long OriginalIssuanceId { get; set; }
        public string OriginalIssuanceNo { get; set; } = string.Empty;
        public long TaskId { get; set; }
        public string TaskName { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public List<MaterialReturnItemDto> Items { get; set; } = new();
    }

    public class MaterialReturnItemDto
    {
        public long ReturnItemId { get; set; }
        public long MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public int UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal ConversionRate { get; set; }
    }
}
