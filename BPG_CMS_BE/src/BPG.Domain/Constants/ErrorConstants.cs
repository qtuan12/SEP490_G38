namespace BPG.Domain.Constants;

/// <summary>
/// Mã lỗi chuẩn trả về trong API response.
/// Dùng trong Exception handler và Result pattern để FE xử lý theo mã lỗi.
/// Convention: PREFIX_NNN → AUTH=xác thực, VAL=validation, BIZ=nghiệp vụ, SYS=hệ thống
/// </summary>
public static class ErrorCodes
{
    // ==================== AUTHENTICATION / AUTHORIZATION ====================
    public const string Unauthorized = "AUTH_001";
    public const string Forbidden = "AUTH_002";
    public const string TokenExpired = "AUTH_003";

    // ==================== VALIDATION ====================
    public const string ValidationFailed = "VAL_001";
    public const string DuplicateEntry = "VAL_002";
    public const string InvalidStatus = "VAL_003";

    // ==================== BUSINESS LOGIC ====================
    public const string NotFound = "BIZ_001";
    public const string InsufficientStock = "BIZ_002";           // Tồn kho không đủ để xuất
    public const string ExceedsBOQ = "BIZ_003";                  // Vượt định mức BOQ
    public const string ExceedsDirectPurchaseLimit = "BIZ_004";  // Vượt giá trị mua khẩn cấp
    public const string InvalidTransition = "BIZ_005";           // Chuyển trạng thái không hợp lệ
    public const string AlreadyApproved = "BIZ_006";             // Phiếu đã duyệt, không sửa được
    public const string StockFrozen = "BIZ_007";                 // Kho đang bị đóng băng (surplus pending)

    // ==================== SYSTEM ====================
    public const string UploadFailed = "SYS_001";
    public const string ExternalServiceError = "SYS_002";
    public const string DatabaseError = "SYS_003";
}
