using System.Net;
using System.Text.Json;
using BPG.Application.Common.Models;
using BPG.Domain.Constants;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace BPG.Api.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger, IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            if (ex is DomainException || ex is FluentValidation.ValidationException)
            {
                _logger.LogWarning("Business validation warning: [{Type}] {Message}", ex.GetType().Name, ex.Message);
            }
            else
            {
                _logger.LogError(ex, "Unhandled exception: [{Type}] {Message}", ex.GetType().Name, ex.Message);
            }
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        HttpStatusCode statusCode;
        ApiResponse response;

        switch (exception)
        {
            case DbUpdateConcurrencyException ex:
                statusCode = HttpStatusCode.Conflict;
                response = ApiResponse.FailureResult(ErrorCodes.DatabaseError, "Dữ liệu tồn kho hoặc thông tin liên quan đã bị thay đổi bởi một phiên làm việc khác. Vui lòng tải lại trang và thực hiện lại.");
                break;

            case NotFoundException ex:
                statusCode = HttpStatusCode.NotFound;
                response = ApiResponse.FailureResult(ex.ErrorCode, ex.Message);
                break;

            case UnauthorizedException ex:
                statusCode = HttpStatusCode.Unauthorized;
                response = ApiResponse.FailureResult(ex.ErrorCode, ex.Message);
                break;

            case ForbiddenException ex:
                statusCode = HttpStatusCode.Forbidden;
                response = ApiResponse.FailureResult(ex.ErrorCode, ex.Message);
                break;

            case DuplicateEntryException ex:
                statusCode = HttpStatusCode.Conflict;
                response = ApiResponse.FailureResult(ex.ErrorCode, ex.Message);
                break;

            case InvalidFileException ex:
                statusCode = HttpStatusCode.BadRequest;
                response = ApiResponse.FailureResult(ex.ErrorCode, ex.Message);
                break;

            // Mọi DomainException còn lại (business rule) → 422 Unprocessable Entity
            case DomainException ex:
                statusCode = HttpStatusCode.UnprocessableEntity;
                response = ApiResponse.FailureResult(ex.ErrorCode, ex.Message);
                break;

            case FluentValidation.ValidationException ex:
                statusCode = HttpStatusCode.BadRequest;
                var validationErrors = ex.Errors.Select(e => e.ErrorMessage).Distinct().ToList();
                response = ApiResponse.FailureResult(ErrorCodes.ValidationFailed, ResponseMessages.ValidationError, validationErrors);
                // Kèm lỗi theo từng trường để FE gắn dòng đỏ ngay dưới ô nhập tương ứng.
                response.FieldErrors = ex.Errors
                    .Where(e => !string.IsNullOrEmpty(e.PropertyName))
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(
                        g => JsonNamingPolicy.CamelCase.ConvertName(g.Key),
                        g => g.Select(e => e.ErrorMessage).Distinct().ToList());
                break;

            default:
                statusCode = HttpStatusCode.InternalServerError;
                var msg = _env.IsDevelopment() ? exception.Message : ResponseMessages.InternalError;
                var devErrors = _env.IsDevelopment()
                    ? new List<string> { exception.StackTrace ?? "" }
                    : null;
                response = ApiResponse.FailureResult(ErrorCodes.DatabaseError, msg, devErrors);
                break;
        }

        context.Response.StatusCode = (int)statusCode;
        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        await context.Response.WriteAsync(JsonSerializer.Serialize(response, options));
    }
}
