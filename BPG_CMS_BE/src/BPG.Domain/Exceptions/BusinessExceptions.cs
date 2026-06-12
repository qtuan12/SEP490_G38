using BPG.Domain.Constants;

namespace BPG.Domain.Exceptions;

/// <summary>
/// Vi phạm nghiệp vụ (business rule). → 422 Unprocessable Entity
/// Dùng cho mọi lỗi logic nghiệp vụ: status không hợp lệ, vượt BOQ, tồn kho không đủ...
/// </summary>
public class BusinessException : DomainException
{
    public BusinessException(string errorCode, string message)
        : base(errorCode, message) { }
}

/// <summary>
/// Tồn kho không đủ để thực hiện thao tác.
/// </summary>
public class InsufficientStockException : DomainException
{
    public InsufficientStockException(string materialName, decimal available, decimal requested, string unit)
        : base(ErrorCodes.InsufficientStock,
            $"Tồn kho vật tư [{materialName}] không đủ. Hiện có: {available} {unit}, yêu cầu: {requested} {unit}.") { }
}

/// <summary>
/// Số lượng vượt định mức BOQ.
/// </summary>
public class ExceedsBOQException : DomainException
{
    public ExceedsBOQException(string materialName)
        : base(ErrorCodes.ExceedsBOQ,
            $"Số lượng vật tư [{materialName}] vượt quá định mức BOQ đã duyệt.") { }
}

/// <summary>
/// Giá trị mua hàng trực tiếp vượt mức cho phép.
/// </summary>
public class ExceedsDirectPurchaseLimitException : DomainException
{
    public ExceedsDirectPurchaseLimitException(decimal amount, decimal maxAmount)
        : base(ErrorCodes.ExceedsDirectPurchaseLimit,
            $"Giá trị mua hàng khẩn ({amount:N0} ₫) vượt mức tối đa cho phép ({maxAmount:N0} ₫).") { }
}

/// <summary>
/// Chuyển trạng thái không hợp lệ theo business workflow.
/// </summary>
public class InvalidStatusTransitionException : DomainException
{
    public InvalidStatusTransitionException(string entityName, string fromStatus, string toStatus)
        : base(ErrorCodes.InvalidTransition,
            $"Không thể chuyển [{entityName}] từ trạng thái [{fromStatus}] sang [{toStatus}].") { }
}

/// <summary>
/// Phiếu đã được duyệt/đóng, không thể sửa hoặc hủy.
/// </summary>
public class AlreadyApprovedException : DomainException
{
    public AlreadyApprovedException(string entityName, object id)
        : base(ErrorCodes.AlreadyApproved,
            $"{entityName} [{id}] đã được phê duyệt, không thể thực hiện thay đổi.") { }
}

/// <summary>
/// Tồn kho đang bị đóng băng do surplus request chưa xử lý.
/// </summary>
public class StockFrozenException : DomainException
{
    public StockFrozenException(string materialName, string projectName)
        : base(ErrorCodes.StockFrozen,
            $"Tồn kho vật tư [{materialName}] tại dự án [{projectName}] đang bị đóng băng do yêu cầu xử lý vật tư dư chưa hoàn tất.") { }
}
