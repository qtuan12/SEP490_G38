namespace BPG.Domain.Constants;

public static class UserRole
{
    public const string Admin = "Admin";
    public const string Director = "Director";
    public const string TechnicalManager = "TechnicalManager";
    public const string SiteEngineer = "SiteEngineer";
    public const string Accountant = "Accountant";
}

public static class RolePolicies
{
    public const string Admin = UserRole.Admin;
    public const string TechnicalManager = UserRole.TechnicalManager;
    public const string DirectorOrTechnicalManager = UserRole.Director + "," + UserRole.TechnicalManager;
    public const string TechnicalManagerOrSiteEngineer = UserRole.TechnicalManager + "," + UserRole.SiteEngineer;
    public const string Accountant = UserRole.Accountant;
    public const string Director = UserRole.Director;
    public const string DirectorTechnicalManagerAccountant =
        UserRole.Director + "," + UserRole.TechnicalManager + "," + UserRole.Accountant;
    public const string BusinessUsers =
        UserRole.Director + "," + UserRole.TechnicalManager + "," +
        UserRole.SiteEngineer + "," + UserRole.Accountant;
    public const string AdminOrTechnicalManager = UserRole.Admin + "," + UserRole.TechnicalManager;
    public const string AdminOrDirector = UserRole.Admin + "," + UserRole.Director;
    public const string ProjectViewers =
        UserRole.Director + "," +
        UserRole.TechnicalManager + "," +
        UserRole.SiteEngineer + "," +
        UserRole.Accountant;
    /// <summary>
    /// ProjectViewers cần danh sách người dùng để chọn thành viên/người phụ trách; Admin cần vì
    /// đây là màn quản trị tài khoản. Admin KHÔNG nằm trong ProjectViewers (không tham gia dự án)
    /// nên phải cộng thêm ở đây, nếu không Admin sửa/xóa được tài khoản mà không xem được danh sách.
    /// </summary>
    public const string UserDirectoryViewers = UserRole.Admin + "," + ProjectViewers;
    public const string SupplierViewers = ProjectViewers;
    public const string SupplierManagers = UserRole.TechnicalManager + "," + UserRole.Accountant;
    public const string Procurement =
        UserRole.Accountant + "," +
        UserRole.TechnicalManager + "," +
        UserRole.Director;
    public const string Reports =
        UserRole.Director + "," +
        UserRole.TechnicalManager + "," +
        UserRole.SiteEngineer + "," +
        UserRole.Accountant;
    public const string MasterData = UserRole.TechnicalManager + "," + UserRole.Accountant;
}

public static class SupplierRelationshipHealth
{
    public const string Excellent = "Excellent";     // Nhiệt tình, chuyên nghiệp, hỗ trợ tối đa.
    public const string Good = "Good";               // Làm việc đúng cam kết, không có gì phàn nàn.
    public const string Neutral = "Neutral";         // Bình thường, không quá nhiệt tình nhưng không gây rắc rối.
    public const string Strained = "Strained";       // "Ghét nhau", làm việc khó khăn, thủ tục rườm rà, thái độ kém.
    public const string Poor = "Poor";               // Hay trễ hạn, hàng hóa lỗi, giao tiếp không vui vẻ, cần cân nhắc cắt hợp đồng.
}

public static class NotificationType
{
    public const string System = "System";
    public const string Progress = "Progress";
    public const string Procurement = "Procurement";
    public const string Incident = "Incident";
}

public static class DailyLogSource
{
    public const string Manual = "Manual";
    public const string DirectAdjustment = "DirectAdjustment";
    public const string IncidentAdjustment = "IncidentAdjustment";

    public const string DirectAdjustmentMarker = "Hệ thống ghi nhận điều chỉnh tiến độ trực tiếp";
    public const string IncidentAdjustmentMarker = "Hệ thống ghi nhận giảm tiến độ";

    public static string Resolve(string? description)
    {
        if (description?.StartsWith(IncidentAdjustmentMarker, StringComparison.Ordinal) == true)
            return IncidentAdjustment;
        if (description?.StartsWith(DirectAdjustmentMarker, StringComparison.Ordinal) == true)
            return DirectAdjustment;
        return Manual;
    }
}

public static class IncidentType
{
    public const string NgoaiLuc = "NgoaiLuc";   // Nguyên nhân ngoại lực (thiên tai, bên thứ 3...)
    public const string NoiLuc = "NoiLuc";       // Nguyên nhân nội bộ (tay nghề, giám sát...)
    public const string VatTu = "VatTu";         // Do vật tư (kém chất lượng, thiếu hàng...)
}

public static class SurplusActionType
{
    public const string ReturnSupplier = "ReturnSupplier"; // Trả lại nhà cung cấp
    public const string Transfer = "Transfer";             // Chuyển sang dự án khác
    public const string Liquidate = "Liquidate";           // Thanh lý
}

public static class InventoryAdjustmentType
{
    public const string Increase = "Increase"; // Điều chỉnh tăng
    public const string Decrease = "Decrease"; // Điều chỉnh giảm
}

public static class InventoryTransactionType
{
    public const byte GoodsReceipt = 1;     // Nhập kho từ PO (tăng)
    public const byte Issuance = 2;         // Xuất kho cho task (giảm)
    public const byte TransferIn = 3;       // Nhận chuyển kho từ dự án khác (tăng)
    public const byte TransferOut = 4;      // Chuyển kho sang dự án khác (giảm)
    public const byte ReturnToSupplier = 5; // Trả lại NCC (giảm)
    public const byte Adjustment = 6;       // Điều chỉnh tăng/giảm (có thể dấu ±)
    public const byte Liquidation = 7;      // Thanh lý vật tư (giảm)
    public const byte IssuanceReturn = 8;   // Hoàn trả vật tư dư từ công trường về kho (tăng)
    public const byte IncidentLoss = 9;     // Giảm tồn do sự cố (giảm)
}

public static class AttachmentType
{
    public const string Design = "Design";               // Bản vẽ thiết kế (Project)
    public const string DailyLogPhoto = "DailyLogPhoto"; // Ảnh nhật ký công trường
    public const string DeliveryPhoto = "DeliveryPhoto"; // Ảnh phiếu giao hàng (GoodsReceipt)
    public const string InvoicePhoto = "InvoicePhoto";   // Ảnh hóa đơn mua ngoài (DirectPurchase)
    public const string IncidentPhoto = "IncidentPhoto"; // Ảnh sự cố (Incident)
    public const string AcceptancePdf = "AcceptancePdf"; // PDF nghiệm thu phase
    public const string SurplusEvidence = "SurplusEvidence"; // Ảnh/Hóa đơn minh chứng thanh lý/trả NCC
    public const string Quotation = "Quotation";         // Ảnh/PDF báo giá nhà cung cấp (PurchaseOrder)
    public const string Other = "Other";                 // Khác
}

public static class NotificationReferenceType
{
    public const string MaterialRequest = "MaterialRequest";
    public const string PurchaseOrder = "PurchaseOrder";
    public const string GoodsReceipt = "GoodsReceipt";
    public const string MaterialIssuance = "MaterialIssuance";
    public const string MaterialReturn = "MaterialReturn";
    public const string DirectPurchaseRequest = "DirectPurchaseRequest";
    public const string Incident = "Incident";
    public const string Task = "Task";
    public const string PhaseAcceptance = "PhaseAcceptance";
    public const string InventoryAdjustment = "InventoryAdjustment";
    public const string SurplusRequest = "SurplusRequest";
    public const string Project = "Project";
}

/// <summary>
/// Đường dẫn workspace gửi kèm thông báo, đặt vào chỗ referenceType.
/// Frontend nhận diện chuỗi bắt đầu bằng '/' là đường dẫn (xem resolveNotificationUrl) và
/// dựng URL mở thẳng chi tiết phiếu trong phạm vi dự án, để bấm quay lại thì về đúng
/// danh sách của dự án đó thay vì danh sách tổng.
/// referenceId đi kèm phải là id của chính phiếu được nhắc tới.
/// </summary>
public static class NotificationLink
{
    public static string ProjectDirectPurchases(long projectId) =>
        $"/projects/{projectId}/workspace/directpurchases";

    public static string ProjectPurchaseOrders(long projectId) =>
        $"/projects/{projectId}/workspace/purchaseorders";

    public static string ProjectSurplus(long projectId) =>
        $"/projects/{projectId}/workspace/surplus";

    public static string ProjectIncidents(long projectId) =>
        $"/projects/{projectId}/workspace/incidents";
}

public static class EntityType
{
    public const string Project = "Project";
    public const string Phase = "Phase";
    public const string ProjectTask = "ProjectTask";
    public const string DailyLog = "DailyLog";
    public const string Incident = "Incident";
    public const string PhaseAcceptance = "PhaseAcceptance";
    public const string MaterialRequest = "MaterialRequest";
    public const string PurchaseOrder = "PurchaseOrder";
    public const string GoodsReceipt = "GoodsReceipt";
    public const string GoodsReceiptReversal = "GoodsReceiptReversal"; // Bút toán đảo chiều khi hủy phiếu nhập kho
    public const string MaterialIssuance = "MaterialIssuance";         // Phiếu xuất kho
    public const string MaterialReturn = "MaterialReturn";             // Phiếu hoàn trả vật tư từ công trường về kho
    public const string DirectPurchaseRequest = "DirectPurchaseRequest";
    public const string SurplusRequest = "SurplusRequest";
    public const string SurplusLiquidation = "SurplusLiquidation";
    public const string SurplusReturnSupplier = "SurplusReturnSupplier";
    public const string SurplusTransferDispatch = "SurplusTransferDispatch";
    public const string SurplusTransferReceive = "SurplusTransferReceive";
    public const string InventoryAdjustment = "InventoryAdjustment";
}

public static class UnitGroup
{
    public const string Length = "Length";       // Chiều dài: m, cm, mm
    public const string Area = "Area";           // Diện tích: m², cm²
    public const string Volume = "Volume";       // Thể tích / khối lượng khô: m³, lít
    public const string Weight = "Weight";       // Khối lượng: kg, tấn
    public const string Count = "Count";         // Cái, bộ, cặp, chiếc...
    public const string Package = "Package";     // Bao, túi, hộp, cuộn
    public const string Time = "Time";           // Ngày công, ca, giờ
}
