namespace BPG.Domain.Constants;

public static class ProjectStatus
{
    public const string Draft = "Draft";
    public const string Active = "Active";
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
}

public static class GoodsReceiptStatus
{
    public const string Draft = "Draft";
    public const string Approved = "Approved";
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

public static class DirectPurchaseStatus
{
    public const string Draft = "Draft";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";
}

public static class DirectPurchaseAuditStatus
{
    public const string PendingAudit = "PendingAudit";
    public const string Audited = "Audited";
    public const string Rejected = "Rejected";
}
