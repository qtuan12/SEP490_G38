namespace BPG.Application.DTOs.DirectPurchases
{
    public class DirectPurchaseItemInput
    {
        public long MaterialId { get; set; }

        /// <summary>
        /// Đơn vị tính người dùng chọn: phải là đơn vị cơ bản của vật tư hoặc một đơn vị
        /// đã khai báo trong bảng quy đổi (MaterialConversion). Để 0 thì hệ thống tự suy ra
        /// (đơn vị của dòng BOQ nếu có, ngược lại là đơn vị cơ bản).
        ///
        /// Tỷ lệ quy đổi KHÔNG nhận từ client — backend luôn tra lại từ DB.
        /// </summary>
        public int UnitId { get; set; }

        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
    }
}
