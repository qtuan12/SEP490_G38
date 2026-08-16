namespace BPG.Domain.Constants;

/// <summary>
/// Template nội dung thông báo push (lưu vào bảng Notifications).
/// Dùng string.Format(): {0} = mã phiếu, {1} = tên project, {2} = actor/lý do
/// </summary>
public static class NotificationTemplates
{
    // ==================== YÊU CẦU VẬT TƯ ====================
    public const string MaterialRequestSubmitted = "Phiếu yêu cầu vật tư [{0}] tại dự án [{1}] vừa được gửi duyệt.";
    public const string MaterialRequestApproved  = "Phiếu yêu cầu vật tư [{0}] đã được duyệt. Có thể tiến hành đặt hàng.";
    public const string MaterialRequestRejected  = "Phiếu yêu cầu vật tư [{0}] bị từ chối. Lý do: {2}.";
    public const string MaterialRequestCancelled = "Phiếu yêu cầu vật tư [{0}] đã bị hủy bởi {2}.";

    // ==================== ĐƠN ĐẶT HÀNG (PO) ====================
    public const string PurchaseOrderCreated  = "PO mới [{0}] tại dự án [{1}] đã được tạo và gửi nhà cung cấp.";
    public const string PurchaseOrderReceived = "PO [{0}] đã nhận đủ hàng. Vui lòng kiểm tra phiếu nhập kho.";

    // ==================== NHẬP KHO ====================
    public const string GoodsReceiptSubmitted = "Phiếu nhập kho [{0}] tại dự án [{1}] cần được phê duyệt.";
    public const string GoodsReceiptApproved  = "Phiếu nhập kho [{0}] đã được duyệt. Kho đã được cập nhật.";

    // ==================== NGHIỆM THU PHA ====================
    public const string PhaseAcceptanceSubmitted = "Pha [{0}] của dự án [{1}] đã nộp hồ sơ nghiệm thu, chờ phê duyệt.";
    public const string PhaseAcceptanceApproved  = "Nghiệm thu pha [{0}] đã được phê duyệt. Pha chính thức hoàn thành.";
    public const string PhaseAcceptanceRejected  = "Nghiệm thu pha [{0}] bị từ chối. Lý do: {2}.";

    // ==================== SỰ CỐ ====================
    public const string IncidentReported       = "Sự cố mới [{0}] tại dự án [{1}] vừa được ghi nhận, cần xử lý.";
    public const string IncidentUnderReview    = "Sự cố [{0}] đang được xem xét bởi kỹ thuật.";
    public const string IncidentResolved       = "Sự cố [{0}] đã được giải quyết bởi {2}.";
    public const string IncidentReviewDeadline = "Sự cố [{0}] tại [{1}] sắp quá hạn xử lý. Vui lòng phản hồi sớm.";

    // ==================== VẬT TƯ DƯ THỪA ====================
    public const string SurplusRequestSubmitted   = "Yêu cầu xử lý vật tư dư [{0}] tại dự án [{1}] đang chờ phân công.";
    public const string SurplusTransferDispatched = "Vật tư chuyển kho [{0}] đã được vận chuyển. Chuẩn bị tiếp nhận.";
    public const string SurplusTransferDispatchedForManager = "Dự án này đã xác nhận gửi hàng vật tư chuyển kho [{0}].";
    public const string SurplusTransferReceived   = "Vật tư chuyển kho [{0}] đã được nhận. Kho đích đã cập nhật.";

    // ==================== ĐIỀU CHỈNH KHO ====================
    public const string AdjustmentPendingApproval = "Phiếu điều chỉnh kho [{0}] tại dự án [{1}] đang chờ phê duyệt.";
    public const string AdjustmentApproved        = "Phiếu điều chỉnh kho [{0}] đã được duyệt. Kho đã được cập nhật.";
    public const string AdjustmentRejected        = "Phiếu điều chỉnh kho [{0}] bị từ chối. Lý do: {2}.";

    // ==================== MUA HÀNG TRỰC TIẾP ====================
    public const string DirectPurchaseSubmitted = "Phiếu mua hàng khẩn [{0}] tại dự án [{1}] cần phê duyệt gấp.";
    public const string DirectPurchaseApproved  = "Phiếu mua hàng khẩn [{0}] đã được duyệt. Tiến hành mua ngay.";
    public const string DirectPurchaseRejected  = "Phiếu mua hàng khẩn [{0}] bị từ chối. Lý do: {2}.";

    // ==================== TỒN KHO ====================
    public const string LowStockAlert          = "Cảnh báo: Vật tư [{0}] tại dự án [{1}] đang ở mức tồn kho thấp ({2} {3} còn lại).";
    public const string StockFrozenAlert       = "Cảnh báo: Tồn kho [{0}] tại dự án [{1}] đang bị đóng băng do surplus chưa xử lý.";
    public const string AutoReleaseStockNotice = "Tự động nhả đóng băng kho [{0}] tại dự án [{1}] do quá hạn xử lý surplus.";

    // ==================== TASK / TIẾN ĐỘ ====================
    public const string TaskAssigned  = "Bạn được giao công việc [{0}] tại pha [{1}] của dự án [{2}].";
    public const string TaskCompleted = "Công việc [{0}] đã hoàn thành, đang chờ nghiệm thu.";
    public const string TaskApproved  = "Công việc [{0}] đã được nghiệm thu và chấp thuận.";
    public const string TaskOverdue   = "Công việc [{0}] tại dự án [{1}] đã quá hạn hoàn thành.";

    // ==================== DỰ ÁN ====================
    public const string ProjectActivated = "Dự án [{0}] đã chính thức được kích hoạt và bắt đầu thi công.";
    public const string ProjectPaused    = "Dự án [{0}] đã tạm dừng thi công.";
    public const string ProjectResumed   = "Dự án [{0}] đã tiếp tục thi công.";
}

/// <summary>
/// Message lỗi validation dùng trong FluentValidation.
/// Dùng: RuleFor(x => x.Name).NotEmpty().WithMessage(ValidationMessages.Required)
/// </summary>
public static class ValidationMessages
{
    // ==================== CHUNG ====================
    public const string Required              = "{PropertyName} không được để trống.";
    public const string MaxLength             = "{PropertyName} không được vượt quá {MaxLength} ký tự.";
    public const string MinLength             = "{PropertyName} phải có ít nhất {MinLength} ký tự.";
    public const string MustBePositive        = "{PropertyName} phải là số dương.";
    public const string MustBeGreaterThanZero = "{PropertyName} phải lớn hơn 0.";
    public const string InvalidFormat         = "{PropertyName} không đúng định dạng.";
    public const string InvalidDate           = "{PropertyName} không phải ngày hợp lệ.";
    public const string DateMustBeFuture      = "{PropertyName} phải là ngày trong tương lai.";
    public const string DateRangeInvalid      = "Ngày bắt đầu phải trước ngày kết thúc.";

    // ==================== ĐỊNH DẠNG CỤ THỂ ====================
    public const string InvalidPhone    = "Số điện thoại không đúng định dạng Việt Nam.";
    public const string InvalidEmail    = "Địa chỉ email không hợp lệ.";
    public const string InvalidTaxCode  = "Mã số thuế không hợp lệ (10 hoặc 13 chữ số).";
    public const string InvalidHexColor = "Mã màu phải đúng định dạng HEX (ví dụ: #3b82f6).";

    // ==================== NGHIỆP VỤ ====================
    public const string InsufficientStock          = "Số lượng xuất kho vượt quá tồn kho hiện tại ({0} {1}).";
    public const string ExceedsBOQ                 = "Số lượng yêu cầu vượt định mức BOQ cho hạng mục này.";
    public const string ExceedsDirectPurchaseLimit = "Giá trị mua hàng khẩn vượt mức tối đa cho phép ({0:N0} ₫).";
    public const string InvalidStatusTransition    = "Không thể chuyển trạng thái từ [{0}] sang [{1}].";
    public const string AlreadyFinalized           = "Phiếu đã được phê duyệt hoặc đóng, không thể chỉnh sửa.";
    public const string DuplicateCode              = "Mã [{0}] đã tồn tại trong hệ thống.";
    public const string ProjectNotActive           = "Dự án không ở trạng thái hoạt động, không thể thực hiện thao tác này.";
    public const string PhaseNotActive             = "Pha thi công chưa bắt đầu hoặc đã kết thúc.";
    public const string FileTooLarge               = "File [{0}] vượt quá dung lượng tối đa cho phép ({1} MB).";
    public const string InvalidFileExtension       = "Loại file [{0}] không được phép tải lên.";
}

/// <summary>
/// Message chuẩn trả về trong API response body.
/// Dùng: return Ok(new { success = true, message = ResponseMessages.ApproveSuccess })
/// </summary>
public static class ResponseMessages
{
    // ==================== THÀNH CÔNG ====================
    public const string GetSuccess     = "Lấy dữ liệu thành công.";
    public const string CreateSuccess  = "Tạo mới thành công.";
    public const string UpdateSuccess  = "Cập nhật thành công.";
    public const string DeleteSuccess  = "Xóa thành công.";
    public const string UploadSuccess  = "Tải file lên thành công.";
    public const string CloneSuccess   = "Nhân bản thành công.";
    public const string ApproveSuccess = "Phê duyệt thành công.";
    public const string RejectSuccess  = "Từ chối thành công.";
    public const string SubmitSuccess  = "Gửi duyệt thành công.";
    public const string CancelSuccess  = "Hủy thành công.";

    // ==================== LỖI CHUNG ====================
    public const string NotFound        = "Không tìm thấy dữ liệu yêu cầu.";
    public const string Unauthorized    = "Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.";
    public const string Forbidden       = "Bạn không có quyền thực hiện thao tác này.";
    public const string ValidationError = "Dữ liệu đầu vào không hợp lệ.";
    public const string InternalError   = "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.";
    public const string DuplicateEntry  = "Dữ liệu đã tồn tại trong hệ thống.";
    public const string OperationFailed = "Thao tác thất bại. Vui lòng thử lại.";

    // ==================== NGHIỆP VỤ CỤ THỂ ====================
    public const string InsufficientStock          = "Tồn kho không đủ để thực hiện yêu cầu.";
    public const string ExceedsBOQ                 = "Số lượng vượt định mức BOQ, yêu cầu phê duyệt thêm.";
    public const string InvalidStatusTransition    = "Không thể thực hiện hành động này với trạng thái hiện tại.";
    public const string AlreadyApproved            = "Phiếu đã được duyệt, không thể chỉnh sửa hoặc hủy.";
    public const string StockFrozen                = "Tồn kho đang bị đóng băng, không thể xuất kho.";
    public const string ExceedsDirectPurchaseLimit = "Giá trị vượt mức mua hàng khẩn. Cần phê duyệt từ cấp cao hơn.";
}

public static class WbsCloneConstants
{
    public const string CopySuffix = " (Bản sao)";
    public const int MaxNameLength = 200;
    public const string InitialProgressReason = "Khởi tạo từ bản sao";
}
