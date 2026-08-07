namespace BPG.Application.DTOs.PurchaseOrders
{
    public class ApprovedRequestForPODto
    {
        public long RequestId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public long ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;
        public long PhaseId { get; set; }
        public string PhaseName { get; set; } = string.Empty;
        public bool HasPO { get; set; }
        public List<RequestItemForPODto> Items { get; set; } = new();
    }

    public class RequestItemForPODto
    {
        public long RequestItemId { get; set; }
        public long MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public string Specification { get; set; } = string.Empty;
        public int UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal ConversionRate { get; set; }
        /// <summary>Tổng số lượng đã đặt qua các PO còn hiệu lực (không tính PO đã hủy).</summary>
        public decimal OrderedQuantity { get; set; }
        /// <summary>Số lượng còn được phép đặt = Quantity - OrderedQuantity.</summary>
        public decimal RemainingQuantity { get; set; }
        /// <summary>
        /// Đơn vị cơ sở của vật tư có yêu cầu số lượng nguyên hay không (Material.BaseUnit.IsDiscrete).
        /// FE dùng cờ này để chặn nhập số lẻ ngay tại ô nhập, khớp đúng rule của BE khi tạo PO.
        /// </summary>
        public bool IsDiscreteUnit { get; set; }
        /// <summary>Tên đơn vị cơ sở dùng trong message khi số lượng không nguyên.</summary>
        public string BaseUnitName { get; set; } = string.Empty;
    }
}
