namespace BPG.Domain.Constants;

/// <summary>
/// Các key cấu hình hệ thống lưu trong bảng SystemConfigs (DB).
/// Dùng để tra cứu giá trị runtime thay vì hardcode trong appsettings.
/// </summary>
public static class SystemConfigKeys
{
    // ==================== WHITE-LABEL / THÔNG TIN CÔNG TY ====================
    // Chỉ khai báo key thật sự có row trong SystemConfigs và được nghiệp vụ đọc.
    // Trang Cấu hình hệ thống liệt kê mọi row nên key khai báo sẵn "để dành" sẽ thành tham số chết:
    // người dùng sửa được mà không có tác dụng gì.
    public const string CompanyName = "CompanyName";               // Tên công ty hiển thị trên sidebar, trang đăng nhập
    public const string CompanyLogoUrl = "CompanyLogoUrl";         // URL logo hiển thị trên sidebar, trang đăng nhập

    // ==================== CẤU HÌNH NGHIỆP VỤ ====================
    // Lưu ý: key thật trong DB của hai tham số dưới là tên tiếng Việt (do bản seed đời đầu),
    // nên giá trị hằng phải là tên tiếng Việt — không đổi được nếu không migrate dữ liệu.
    public const string LowStockThreshold = "NguongTonKhoThap";             // Ngưỡng tồn kho thấp (cảnh báo)
    public const string LowStockThresholdEn = "LowStockThreshold";          // Biến thể tiếng Anh, chỉ đọc để tương thích dữ liệu cũ
    public const string CancellationDays = "HanHuyPhieuNgay";               // Số ngày được hủy phiếu nhập kho

    public const string ExpectedDelayPercent = "ExpectedDelayPercent";      // % trễ tiến độ tối đa trước khi báo động đỏ
    public const string DailyLogEditWindowHours = "DailyLogEditWindowHours"; // Số giờ được phép chỉnh sửa nhật ký thi công kể từ lúc tạo

    // Hạn mức tiền mua khẩn cấp CỘNG DỒN trong một giai đoạn. Đặt 0 = không giới hạn (tắt chặn).
    public const string DirectPurchasePhaseMaxAmount = "DirectPurchasePhaseMaxAmount";
}
