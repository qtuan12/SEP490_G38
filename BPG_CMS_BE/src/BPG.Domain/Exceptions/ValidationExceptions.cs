using BPG.Domain.Constants;

namespace BPG.Domain.Exceptions;

/// <summary>
/// Dữ liệu bị trùng lặp (unique constraint). → 409 Conflict
/// </summary>
public class DuplicateEntryException : DomainException
{
    public DuplicateEntryException(string fieldName, object value)
        : base(ErrorCodes.DuplicateEntry, $"[{fieldName}] với giá trị [{value}] đã tồn tại trong hệ thống.") { }
}

/// <summary>
/// File upload vượt dung lượng hoặc sai định dạng. → 400 Bad Request
/// </summary>
public class InvalidFileException : DomainException
{
    public InvalidFileException(string message)
        : base(ErrorCodes.UploadFailed, message) { }

    public static InvalidFileException TooLarge(string fileName, double sizeMb, double maxMb)
        => new($"File [{fileName}] có kích thước {sizeMb:F1} MB vượt quá giới hạn cho phép {maxMb} MB.");

    public static InvalidFileException InvalidExtension(string fileName, string allowedExtensions)
        => new($"File [{fileName}] có định dạng không được phép. Chỉ chấp nhận: {allowedExtensions}.");
}
