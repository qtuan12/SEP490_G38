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
    public const string CurrentPasswordIncorrect = "AUTH_004";   // Mật khẩu hiện tại nhập sai khi đổi mật khẩu
    public const string SamePassword = "AUTH_005";               // Mật khẩu mới trùng mật khẩu cũ

    // ---- Luồng quên mật khẩu / OTP ----
    // Tách riêng từng tình huống để FE xử lý khác nhau (hết hạn thì mời gửi lại mã,
    // sai mã thì cho nhập lại), thay vì gộp chung một mã như trước.
    public const string OtpEmailNotFound = "AUTH_010";           // Email không tồn tại trong hệ thống
    public const string OtpNotFound = "AUTH_011";                // Không có mã OTP nào đang chờ xác thực
    public const string OtpExpired = "AUTH_012";                 // Mã OTP đã hết hạn
    public const string OtpTooManyAttempts = "AUTH_013";         // Nhập sai OTP quá số lần cho phép
    public const string OtpIncorrect = "AUTH_014";               // Mã OTP không đúng
    public const string ResetSessionInvalid = "AUTH_015";        // Reset token không hợp lệ hoặc đã hết hạn

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
    public const string InvalidUnitQuantity = "BIZ_008";         // Số lượng không hợp lệ đối với ĐVT rời rạc

    // ==================== ĐƠN MUA HÀNG (PO) ====================
    public const string PoAlreadyCancelled = "BIZ_009";          // PO đã bị hủy trước đó
    public const string PoCannotCancel = "BIZ_010";              // PO đã nhận hàng hoặc đã đóng, không hủy được
    public const string PoHasReceipts = "BIZ_011";               // PO đã có phiếu nhập kho được duyệt
    public const string PoCannotClose = "BIZ_012";               // PO không ở trạng thái nhận một phần
    public const string PoCancelReasonRequired = "BIZ_013";      // Thiếu lý do hủy PO
    public const string PoCloseReasonRequired = "BIZ_014";       // Thiếu lý do đóng PO
    public const string PoNumberExists = "BIZ_015";              // Số PO đã tồn tại
    public const string PoRequestNotApproved = "BIZ_016";        // Yêu cầu vật tư chưa được duyệt
    public const string PoMaterialNotInRequest = "BIZ_017";      // Vật tư không thuộc yêu cầu đã chọn
    public const string PoQtyExceedsRequest = "BIZ_018";         // SL đặt vượt SL còn lại của yêu cầu
    public const string PoOrderDateBeforeProject = "BIZ_019";    // Ngày đơn hàng trước ngày bắt đầu dự án
    public const string PoOrderDateAfterPhase = "BIZ_020";       // Ngày đơn hàng sau ngày kết thúc giai đoạn
    public const string PoDeliveryDateBeforeProject = "BIZ_021"; // Hạn giao hàng trước ngày bắt đầu dự án
    public const string PoDeliveryDateAfterPhase = "BIZ_022";    // Hạn giao hàng sau ngày kết thúc giai đoạn
    public const string PoNotPendingApproval = "BIZ_041";        // PO không ở trạng thái chờ Giám đốc duyệt
    public const string PoRejectReasonRequired = "BIZ_042";      // Thiếu lý do khi Giám đốc từ chối PO
    public const string PoNotApproved = "BIZ_043";               // PO chưa được Giám đốc duyệt

    // ==================== MUA HÀNG TRỰC TIẾP (DP) ====================
    public const string DpNotDraft = "BIZ_023";                  // Phiếu không còn ở trạng thái Nháp
    public const string DpNotSubmitted = "BIZ_024";              // Phiếu chưa gửi nên chưa kiểm toán được
    public const string DpAlreadyAudited = "BIZ_025";            // Phiếu đã kiểm toán, không thao tác lại
    public const string DpAuditNoteRequired = "BIZ_026";         // Thiếu lý do khi từ chối kiểm toán
    public const string DpRejectionReasonRequired = "BIZ_027";   // Thiếu lý do khi từ chối duyệt chi
    public const string DpInvalidStatusForApproval = "BIZ_028";  // Phiếu không ở trạng thái chờ Giám đốc duyệt
    public const string DpNoItems = "BIZ_029";                   // Phiếu chưa có vật tư nào
    public const string DpNoReason = "BIZ_030";                  // Thiếu lý do mua khẩn cấp
    public const string DpNoInvoice = "BIZ_031";                 // Chưa tải ảnh hóa đơn
    public const string DpInvalidQuantity = "BIZ_032";           // Số lượng vật tư <= 0
    public const string DpInvalidUnitPrice = "BIZ_033";          // Đơn giá vật tư <= 0
    public const string DpProjectNotActive = "BIZ_034";          // Dự án không ở trạng thái đang thi công
    public const string DpPhaseFrozen = "BIZ_035";               // Giai đoạn đã nghiệm thu, bị đóng băng
    public const string DpPurchaseDateInFuture = "BIZ_036";      // Ngày mua ở tương lai
    public const string DpPurchaseDateBeforeProject = "BIZ_037";  // Ngày mua trước ngày bắt đầu dự án
    public const string DpPurchaseDateAfterPhase = "BIZ_038";    // Ngày mua sau ngày kết thúc giai đoạn
    public const string DpPhaseProjectMismatch = "BIZ_039";      // Giai đoạn không thuộc dự án đã chọn
    public const string DpDuplicateMaterial = "BIZ_040";         // Vật tư bị khai báo trùng trong phiếu
    public const string DpInvalidUnit = "BIZ_044";               // ĐVT không thuộc đơn vị cơ bản/quy đổi của vật tư
    public const string DpMaterialNotInBoq = "BIZ_049";          // Vật tư chưa có trong định mức BOQ của giai đoạn
    public const string DpOverPhaseMaxAmount = "BIZ_050";        // Mua khẩn cấp cộng dồn của giai đoạn vượt hạn mức

    // ==================== TÀI KHOẢN NGƯỜI DÙNG ====================
    public const string UserCannotDeleteSelf = "BIZ_045";        // Tự xóa/khóa chính tài khoản đang đăng nhập
    public const string UserLastAdmin = "BIZ_046";               // Xóa/khóa Quản trị viên cuối cùng
    public const string UserIsProjectLeader = "BIZ_047";         // Còn là trưởng dự án đang chạy
    public const string UserLastApprover = "BIZ_048";            // Người duyệt cuối cùng của hàng chờ đang có phiếu

    // ==================== SYSTEM ====================
    public const string UploadFailed = "SYS_001";
    public const string ExternalServiceError = "SYS_002";
    public const string DatabaseError = "SYS_003";
}
