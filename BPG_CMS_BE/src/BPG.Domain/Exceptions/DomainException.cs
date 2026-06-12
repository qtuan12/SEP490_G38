namespace BPG.Domain.Exceptions;

/// <summary>
/// Base class cho tất cả domain exception.
/// Bắt buộc truyền errorCode (từ ErrorCodes) để FE xử lý theo mã lỗi.
/// </summary>
public abstract class DomainException : Exception
{
    public string ErrorCode { get; }

    protected DomainException(string errorCode, string message)
        : base(message)
    {
        ErrorCode = errorCode;
    }
}
