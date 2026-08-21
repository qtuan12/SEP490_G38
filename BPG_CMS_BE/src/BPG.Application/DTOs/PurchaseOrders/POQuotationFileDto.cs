namespace BPG.Application.DTOs.PurchaseOrders
{
    /// <summary>
    /// Tệp báo giá nhà cung cấp đính kèm đơn mua hàng (ảnh chụp hoặc PDF).
    /// Client tải tệp lên qua /files/upload-multiple với folder "purchase-orders/quotations"
    /// rồi gửi lại metadata trả về ở đây, giống luồng bản vẽ thiết kế của dự án.
    /// </summary>
    public class POQuotationFileDto
    {
        public string FileName { get; set; } = string.Empty;
        public string FileUrl { get; set; } = string.Empty;
        public string? ContentType { get; set; }
        public long? FileSizeBytes { get; set; }
    }
}
