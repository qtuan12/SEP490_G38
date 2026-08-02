namespace BPG.Application.DTOs.DirectPurchases
{
    public class DirectPurchaseItemInput
    {
        public long MaterialId { get; set; }
        /// <summary>
        /// Đơn vị tính KHÔNG nhận từ client - hệ thống suy ra từ vật tư
        /// (đơn vị của dòng BOQ nếu có, ngược lại là đơn vị cơ bản).
        /// </summary>
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
    }
}
