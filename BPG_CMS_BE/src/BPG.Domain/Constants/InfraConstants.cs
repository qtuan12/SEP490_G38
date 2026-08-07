namespace BPG.Domain.Constants;

/// <summary>
/// Tên các method SignalR Hub push từ Server → Client.
/// Dùng trong NotificationHub (server) và JS/TS client listener.
/// </summary>
public static class HubMethodNames
{
    // ==================== SERVER → CLIENT ====================
    public const string ReceiveNotification = "ReceiveNotification";       // Thông báo mới
    public const string ReceiveProgressUpdate = "ReceiveProgressUpdate";   // Cập nhật tiến độ task/phase
    public const string ReceiveStockAlert = "ReceiveStockAlert";           // Cảnh báo tồn kho thấp
    public const string ReceiveIncidentAlert = "ReceiveIncidentAlert";     // Sự cố mới cần xử lý
    public const string ReceiveApprovalRequest = "ReceiveApprovalRequest"; // Phiếu cần duyệt

    public const string IncidentCreated = "IncidentCreated";               // Báo cáo sự cố mới
    public const string IncidentUpdated = "IncidentUpdated";               // Trạng thái sự cố cập nhật
    public const string ProjectUpdated = "ProjectUpdated";                 // Trạng thái dự án cập nhật
    public const string InventoryAdjustmentCreated = "InventoryAdjustmentCreated"; // Phiếu điều chỉnh kho mới
    public const string InventoryAdjustmentUpdated = "InventoryAdjustmentUpdated"; // Phiếu điều chỉnh kho được cập nhật
    public const string DataChanged = "DataChanged";                       // Dữ liệu hệ thống đã thay đổi

    public const string PurchaseOrderUpdated = "PurchaseOrderUpdated";     // Đơn hàng thay đổi (tạo/duyệt/từ chối/hủy/đóng)
    public const string DirectPurchaseUpdated = "DirectPurchaseUpdated";   // Phiếu mua trực tiếp thay đổi (gửi/kiểm/duyệt chi)

    public const string GoodsReceiptChanged = "GoodsReceiptChanged";       // Nhập kho thay đổi (tạo/hủy phiếu)
    public const string MaterialIssuanceChanged = "MaterialIssuanceChanged"; // Xuất dùng thay đổi
    public const string MaterialReturnChanged = "MaterialReturnChanged";  // Hoàn trả vật tư thay đổi

    // ==================== HUB GROUP PREFIXES ====================
    // Dùng: Groups.AddToGroupAsync(connectionId, HubMethodNames.GroupProject + projectId)
    public const string GroupProject = "Project_"; // + projectId → "Project_123" (phải khớp với NotificationHub: $"Project_{projectId}")
    public const string GroupRole = "role_";        // + role     → "role_Admin"
    public const string GroupUser = "user_";        // + userId   → "user_456"
}

/// <summary>
/// Key prefix cho Redis / MemoryCache.
/// Dùng: cache.GetOrCreate(CacheKeys.ProjectDetail + projectId, ...)
/// </summary>
public static class CacheKeys
{
    public const string SystemConfig = "sys:config";          // Toàn bộ cấu hình hệ thống
    public const string UnitList = "master:units";            // Danh sách đơn vị
    public const string MaterialCatalog = "master:materials"; // Danh mục vật tư
    public const string SupplierList = "master:suppliers";    // Danh sách nhà cung cấp

    // Pattern keys (append ID sau prefix)
    public const string ProjectDetail = "project:";           // + projectId
    public const string ProjectStock = "stock:project:";      // + projectId
    public const string UserPermission = "perm:user:";        // + userId
    public const string PhaseProgress = "progress:phase:";    // + phaseId
}

/// <summary>
/// Đường dẫn thư mục lưu file trên blob storage (MinIO / Azure Blob / S3).
/// </summary>
public static class StorageFolders
{
    public const string ProjectDesigns = "projects/designs";           // Bản vẽ thiết kế
    public const string DailyLogPhotos = "daily-logs/photos";         // Ảnh nhật ký công trường
    public const string DeliveryPhotos = "goods-receipts/photos";     // Ảnh phiếu giao hàng
    public const string InvoicePhotos = "direct-purchases/invoices";  // Ảnh hóa đơn mua ngoài
    public const string IncidentPhotos = "incidents/photos";           // Ảnh sự cố
    public const string AcceptanceDocs = "phase-acceptances/docs";    // PDF nghiệm thu
    public const string Avatars = "users/avatars";                     // Ảnh đại diện người dùng
    public const string Temp = "temp";                                 // Upload tạm, xóa sau 24h
}

/// <summary>
/// Regex pattern dùng chung trong FluentValidation.
/// Dùng: RuleFor(x => x.Phone).Matches(ValidationPattern.PhoneVN)
/// </summary>
public static class ValidationPattern
{
    public const string PhoneVN = @"^(0|\+84)(3[2-9]|5[6-9]|7[06-9]|8[0-9]|9[0-9])\d{7}$"; // Số điện thoại VN
    public const string Email = @"^[^@\s]+@[^@\s]+\.[^@\s]+$";                                 // Email cơ bản
    public const string TaxCodeVN = @"^\d{10}(-\d{3})?$";                                      // MST VN: 10 hoặc 13 chữ số
    public const string HexColor = @"^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$";                    // Màu hex (#fff, #3b82f6)
    public const string Slug = @"^[a-z0-9]+(?:-[a-z0-9]+)*$";                                 // URL slug
    public const string PositiveDecimal = @"^\d+(\.\d{1,4})?$";                                // Số dương tối đa 4 chữ số thập phân
}
