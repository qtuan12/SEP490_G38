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
    public const string Resolved = "Resolved";
    public const string Closed = "Closed";
}

public static class BOQCheckStatus
{
    public const string WithinBOQ = "WithinBOQ";
    public const string OverBOQ = "OverBOQ";
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

public static class PurchaseOrderStatus
{
    public const string Draft = "Draft";
    public const string Sent = "Sent";
    public const string PartiallyReceived = "PartiallyReceived";
    public const string FullyReceived = "FullyReceived";
    public const string Closed = "Closed";
    public const string Cancelled = "Cancelled";
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
}

/// <summary>
/// Trạng thái DUYỆT CHI của phiếu mua trực tiếp (có được hoàn tiền hay không).
/// Không gác tồn kho: tồn kho được cộng ngay tại bước Submit, độc lập với các trạng thái dưới đây.
/// </summary>
public static class DirectPurchaseStatus
{
    /// <summary>Nháp, chưa gửi. Chưa sinh PO/GR/tồn kho, chỉ người tạo nhìn thấy.</summary>
    public const string Draft = "Draft";
    /// <summary>Đã gửi, vượt định mức BOQ, chờ Kế toán đối chiếu hóa đơn.</summary>
    public const string Pending = "Pending";
    /// <summary>Kế toán đã soát hóa đơn, chờ Giám đốc duyệt chi vượt định mức.</summary>
    public const string WaitingApproval = "WaitingApproval";
    public const string Approved = "Approved";
    /// <summary>Không được hoàn tiền. Vật tư vẫn đã nhập kho và vẫn tiêu thụ định mức BOQ.</summary>
    public const string Rejected = "Rejected";
}

public static class DirectPurchaseAuditStatus
{
    public const string PendingAudit = "PendingAudit";
    public const string Audited = "Audited";
    public const string Rejected = "Rejected";
}
