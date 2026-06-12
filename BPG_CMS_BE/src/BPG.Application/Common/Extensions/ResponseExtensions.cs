using System;
using BPG.Application.Common.Models;

namespace BPG.Application.Common.Extensions
{
    public static class ResponseExtensions
    {
        public static ApiResponse<T> ToSuccessResponse<T>(this T data, string? message = null)
        {
            return ApiResponse<T>.SuccessResult(data, message);
        }

        public static ApiResponse ToFailedResponse(this Exception ex)
        {
            return ApiResponse.FailureResult(ex.Message);
        }
    }
}
