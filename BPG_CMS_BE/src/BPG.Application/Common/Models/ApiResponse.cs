using System;
using System.Collections.Generic;

namespace BPG.Application.Common.Models
{
    public class ApiResponse
    {
        public bool Success { get; set; }
        public string? Message { get; set; }
        public List<string>? Errors { get; set; }

        public static ApiResponse SuccessResult(string? message = null)
            => new() { Success = true, Message = message };

        public static ApiResponse FailureResult(string? message, List<string>? errors = null)
            => new() { Success = false, Message = message, Errors = errors };

        public static ApiResponse FailureResult(List<string> errors)
            => new() { Success = false, Errors = errors };
    }

    public class ApiResponse<T> : ApiResponse
    {
        public T? Data { get; set; }

        public static ApiResponse<T> SuccessResult(T data, string? message = null)
            => new() { Success = true, Data = data, Message = message };

        public static new ApiResponse<T> FailureResult(string? message, List<string>? errors = null)
            => new() { Success = false, Message = message, Errors = errors };

        public static new ApiResponse<T> FailureResult(List<string> errors)
            => new() { Success = false, Errors = errors };
    }
}
