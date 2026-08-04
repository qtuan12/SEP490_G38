namespace BPG.Application.Common.Models;

public class ApiResponse
{
    public bool Success { get; set; }
    public string? ErrorCode { get; set; }
    public string? Message { get; set; }
    public List<string>? Errors { get; set; }

    /// <summary>
    /// Lỗi validate theo từng trường: key là tên property của command (camelCase khi serialize),
    /// value là các thông báo của trường đó. FE dùng để hiển thị dòng đỏ ngay dưới đúng ô nhập
    /// thay vì gộp tất cả vào một message.
    /// </summary>
    public Dictionary<string, List<string>>? FieldErrors { get; set; }

    public static ApiResponse SuccessResult(string? message = null)
        => new() { Success = true, Message = message };

    public static ApiResponse FailureResult(string errorCode, string message, List<string>? errors = null)
        => new() { Success = false, ErrorCode = errorCode, Message = message, Errors = errors };

    // Overload giữ backward compat
    public static ApiResponse FailureResult(string? message, List<string>? errors = null)
        => new() { Success = false, Message = message, Errors = errors };
}

public class ApiResponse<T> : ApiResponse
{
    public T? Data { get; set; }

    public static ApiResponse<T> SuccessResult(T data, string? message = null)
        => new() { Success = true, Data = data, Message = message };

    public static new ApiResponse<T> FailureResult(string errorCode, string message, List<string>? errors = null)
        => new() { Success = false, ErrorCode = errorCode, Message = message, Errors = errors };

    public static new ApiResponse<T> FailureResult(string? message, List<string>? errors = null)
        => new() { Success = false, Message = message, Errors = errors };
}
