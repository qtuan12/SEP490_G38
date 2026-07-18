namespace BPG.Domain.Constants;

/// <summary>
/// Các key cấu hình hệ thống lưu trong bảng SystemConfigs (DB).
/// Dùng để tra cứu giá trị runtime thay vì hardcode trong appsettings.
/// </summary>
public static class SystemConfigKeys
{
    // ==================== WHITE-LABEL / THÔNG TIN CÔNG TY ====================
    public const string CompanyName = "CompanyName";               // Tên công ty sử dụng phần mềm
    public const string CompanyLogoUrl = "CompanyLogoUrl";         // URL logo hiển thị trên header, login
    public const string CompanyAddress = "CompanyAddress";         // Địa chỉ công ty
    public const string CompanyPhone = "CompanyPhone";             // Số điện thoại liên hệ
    public const string CompanyEmail = "CompanyEmail";             // Email hỗ trợ
    public const string CompanyWebsite = "CompanyWebsite";         // Website công ty
    public const string CompanyTaxCode = "CompanyTaxCode";         // Mã số thuế (nếu cần hiển thị trên báo cáo)
    public const string FaviconUrl = "FaviconUrl";                 // Icon trình duyệt

    // ==================== CẤU HÌNH NGHIỆP VỤ ====================
    public const string LowStockThreshold = "LowStockThreshold";           // Ngưỡng tồn kho thấp (cảnh báo)
    public const string CancellationDays = "CancellationDays";             // Số ngày được hủy phiếu (nghiệm thu, PO...)
    public const string ExpectedDelayPercent = "ExpectedDelayPercent";     // % trễ kỳ vọng để cảnh báo vàng
    public const string DirectPurchaseMaxAmount = "DirectPurchaseMaxAmount"; // Giá trị tối đa mua khẩn cấp (VND)
    public const string DefaultPageSize = "DefaultPageSize";               // Số bản ghi mặc định trên 1 trang
    public const string MaxUploadSizeMB = "MaxUploadSizeMB";               // Dung lượng tối đa mỗi file upload (MB)
    public const string AllowedImageExtensions = "AllowedImageExtensions"; // Phần mở rộng ảnh cho phép (jpg,png,...)
    public const string IncidentReviewDeadlineDays = "IncidentReviewDeadlineDays";         // Thời hạn TPKT phải xử lý incident (ngày)
    public const string AutoReleaseReservedStockDays = "AutoReleaseReservedStockDays";     // Tự động nhả stock đã đóng băng nếu surplus không xử lý sau N ngày

    public const string DailyLogEditWindowHours = "DailyLogEditWindowHours";   // Số giờ được phép chỉnh sửa nhật ký thi công kể từ lúc tạo

    // ==================== TÍCH HỢP & GỬI EMAIL ====================
    public const string SmtpServer = "SmtpServer";                 // SMTP server
    public const string SmtpPort = "SmtpPort";                     // SMTP port
    public const string SmtpUsername = "SmtpUsername";             // Tài khoản gửi email
    public const string SmtpPassword = "SmtpPassword";             // Mật khẩu (nên lưu mã hóa)
    public const string SmtpEnableSsl = "SmtpEnableSsl";           // Bật SSL hay không (bool)
    public const string EmailFromAddress = "EmailFromAddress";     // Địa chỉ email người gửi mặc định

    // ==================== GIAO DIỆN NGƯỜI DÙNG ====================
    public const string PrimaryColor = "PrimaryColor";             // Màu chủ đạo (hex, ví dụ #3b82f6)
    public const string SecondaryColor = "SecondaryColor";         // Màu phụ
    public const string HeaderLogoUrl = "HeaderLogoUrl";           // Logo riêng cho header (có thể khác CompanyLogoUrl)
    public const string LoginBackgroundUrl = "LoginBackgroundUrl"; // Hình nền màn hình login
    public const string DateFormat = "DateFormat";                 // Định dạng ngày (dd/MM/yyyy, yyyy-MM-dd...)
    public const string CurrencySymbol = "CurrencySymbol";         // Ký hiệu tiền tệ (₫, $, €)
}
