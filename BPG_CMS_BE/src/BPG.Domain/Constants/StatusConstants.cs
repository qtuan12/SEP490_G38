namespace BPG.Domain.Constants;

public static class ProjectStatus
{
    public const string Draft = "Draft";
    public const string InProgress = "InProgress";
    public const string Paused = "Paused";
    public const string Completed = "Completed";
    public const string Closed = "Closed";
}

public static class PhaseStatus
{
    public const string Draft = "Draft";
    public const string InProgress = "InProgress";
    public const string Completed = "Completed";
    public const string Approved = "Approved";
}

public static class TaskStatus
{
    public const string New = "New";
    public const string Assigned = "Assigned";
    public const string InProgress = "InProgress";
    public const string Completed = "Completed";
    public const string Approved = "Approved";
    public const string Obsolete = "Obsolete";
}

public static class IncidentStatus
{
    public const string Reported = "Reported";
    public const string UnderReview = "WaitingReview";
    public const string WaitingAccountant = "WaitingAccountant";
    public const string UnderResolution = "UnderResolution";
    public const string Rejected = "Rejected";
    public const string Approved = "Approved";
    public const string Resolved = "Resolved";
    public const string Closed = "Closed";
}

public static class BOQCheckStatus
{
    public const string WithinBOQ = "WithinBOQ";
    public const string OverBOQ = "OverBOQ";
}

public static class BOQImportRowStatus
{
    public const string New = "New";
    public const string Updated = "Updated";
    public const string Unchanged = "Unchanged";
    public const string Deleted = "Deleted";
    public const string Error = "Error";
}

public static class MaterialRequestStatus
{
    public const string Draft = "Draft";
    public const string Pending = "Pending";
    public const string WaitingApproval = "WaitingApproval";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";
    public const string Cancelled = "Cancelled";
}

public static class MaterialRequestProcurementDecision
{
    public const string ExternalPurchase = "ExternalPurchase";
    public const string InternalTransfer = "InternalTransfer";
    public const string WaitSupply = "WaitSupply";
    public const string NeedMoreInfo = "NeedMoreInfo";
    public const string NotApproved = "NotApproved";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        ExternalPurchase,
        InternalTransfer,
        WaitSupply,
        NeedMoreInfo,
        NotApproved
    };

    public static bool IsValid(string? decision) =>
        decision is not null && All.Contains(decision);

    public static string ResolveTechnicalStatus(string decision, string boqCheckStatus)
    {
        if (!IsValid(decision))
        {
            throw new ArgumentException("Invalid material request procurement decision.", nameof(decision));
        }

        if (decision != ExternalPurchase)
        {
            return MaterialRequestStatus.Rejected;
        }

        return boqCheckStatus == BOQCheckStatus.WithinBOQ
            ? MaterialRequestStatus.Approved
            : MaterialRequestStatus.WaitingApproval;
    }
}

public static class PurchaseOrderStatus
{
    public const string Draft = "Draft";
    /// <summary>Kế toán đã lập đơn, chờ Giám đốc duyệt. Chưa được gửi NCC và chưa nhập kho được.</summary>
    public const string PendingApproval = "PendingApproval";
    /// <summary>Giám đốc từ chối. Số lượng vật tư được trả lại yêu cầu để lập đơn khác.</summary>
    public const string Rejected = "Rejected";
    public const string Sent = "Sent";
    public const string PartiallyReceived = "PartiallyReceived";
    public const string FullyReceived = "FullyReceived";
    public const string Closed = "Closed";
    public const string Cancelled = "Cancelled";

    /// <summary>
    /// Các trạng thái KHÔNG còn giữ chỗ số lượng của yêu cầu vật tư — đơn ở những trạng thái này
    /// coi như không tồn tại khi tính số lượng còn được đặt.
    /// </summary>
    public static bool IsVoid(string status) =>
        status == Cancelled || status == Rejected;

    /// <summary>
    /// Nhãn tiếng Việt dùng khi ghép message trả về người dùng — không để lộ tên trạng thái tiếng Anh.
    /// Đồng bộ với statusLabel bên frontend (pages/PurchaseOrders).
    /// </summary>
    public static string Label(string status) => status switch
    {
        Draft => "Nháp",
        PendingApproval => "Chờ Giám đốc duyệt",
        Rejected => "Bị từ chối",
        Sent => "Đã gửi nhà cung cấp",
        PartiallyReceived => "Nhập kho một phần",
        FullyReceived => "Đã nhập đủ",
        Closed => "Đã đóng",
        Cancelled => "Đã hủy",
        _ => status
    };
}

public static class GoodsReceiptStatus
{
    public const string Draft = "Draft";
    public const string Approved = "Approved";
    public const string Cancelled = "Cancelled";
}

public static class SurplusRequestStatus
{
    public const string Draft = "Draft";
    public const string Processing = "Processing";
    public const string Processed = "Processed";
}

public static class SurplusRequestItemStatus
{
    public const string Pending = "Pending";
    public const string Processing = "Processing";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";
}

public static class SurplusTransferStatus
{
    public const string Pending = "Pending";
    public const string Approved = "Approved";
    public const string Dispatched = "Dispatched";
    public const string Received = "Received";
    public const string Rejected = "Rejected";
}

public static class InventoryAdjustmentStatus
{
    public const string Draft = "Draft";
    public const string Pending = "Pending";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";
    public const string RevisionRequired = "RevisionRequired";
    public const string Cancelled = "Cancelled";
}

/// <summary>
/// Trạng thái DUYỆT CHI của phiếu mua trực tiếp (có được hoàn tiền hay không).
/// Không gác tồn kho: tồn kho được cộng ngay tại bước Submit, độc lập với các trạng thái dưới đây.
/// </summary>
public static class DirectPurchaseStatus
{
    /// <summary>Nháp, chưa gửi. Chưa sinh PO/GR/tồn kho, chỉ người tạo nhìn thấy.</summary>
    public const string Draft = "Draft";
    /// <summary>Đã gửi, chờ Kế toán đối chiếu hóa đơn. Áp dụng cho mọi phiếu, kể cả trong định mức BOQ.</summary>
    public const string Pending = "Pending";
    /// <summary>Kế toán đã soát hóa đơn, chờ Giám đốc duyệt chi.</summary>
    public const string WaitingApproval = "WaitingApproval";
    public const string Approved = "Approved";
    /// <summary>Không được hoàn tiền. Vật tư vẫn đã nhập kho và vẫn tiêu thụ định mức BOQ.</summary>
    public const string Rejected = "Rejected";

    /// <summary>
    /// Nhãn tiếng Việt dùng khi ghép message trả về người dùng — không để lộ tên trạng thái tiếng Anh.
    /// Đồng bộ với DP_STATUS_LABEL bên frontend (services/directPurchaseService.ts).
    /// </summary>
    public static string Label(string status) => status switch
    {
        Draft => "Nháp",
        Pending => "Chờ Kế toán",
        WaitingApproval => "Chờ Giám đốc",
        Approved => "Đã duyệt",
        Rejected => "Từ chối",
        _ => status
    };
}

public static class DirectPurchaseAuditStatus
{
    public const string PendingAudit = "PendingAudit";
    public const string Audited = "Audited";
    public const string Rejected = "Rejected";
}
