using System.Net;
using System.Text.Json;
using BPG.Application.Common.Models;
using BPG.Domain.Constants;
using BPG.Domain.Exceptions;

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
            _logger.LogError(ex, "Unhandled exception: [{Type}] {Message}", ex.GetType().Name, ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        var (statusCode, errorCode, message, errors) = exception switch
        {
            // ── Domain Exceptions ──────────────────────────────────────────────
            NotFoundException ex =>
                (HttpStatusCode.NotFound, ex.ErrorCode, ex.Message, (List<string>?)null),

            UnauthorizedException ex =>
                (HttpStatusCode.Unauthorized, ex.ErrorCode, ex.Message, null),

            ForbiddenException ex =>
                (HttpStatusCode.Forbidden, ex.ErrorCode, ex.Message, null),

            InvalidStatusTransitionException ex =>
                (HttpStatusCode.UnprocessableEntity, ex.ErrorCode, ex.Message, null),

            AlreadyApprovedException ex =>
                (HttpStatusCode.UnprocessableEntity, ex.ErrorCode, ex.Message, null),

            InsufficientStockException ex =>
                (HttpStatusCode.UnprocessableEntity, ex.ErrorCode, ex.Message, null),

            ExceedsBOQException ex =>
                (HttpStatusCode.UnprocessableEntity, ex.ErrorCode, ex.Message, null),

            ExceedsDirectPurchaseLimitException ex =>
                (HttpStatusCode.UnprocessableEntity, ex.ErrorCode, ex.Message, null),

            StockFrozenException ex =>
                (HttpStatusCode.UnprocessableEntity, ex.ErrorCode, ex.Message, null),

            DuplicateEntryException ex =>
                (HttpStatusCode.Conflict, ex.ErrorCode, ex.Message, null),

            InvalidFileException ex =>
                (HttpStatusCode.BadRequest, ex.ErrorCode, ex.Message, null),

            // Catch-all for any remaining DomainException subclass
            DomainException ex =>
                (HttpStatusCode.UnprocessableEntity, ex.ErrorCode, ex.Message, null),

            // ── FluentValidation ───────────────────────────────────────────────
            FluentValidation.ValidationException ex => (
                HttpStatusCode.BadRequest,
                ErrorCodes.ValidationFailed,
                ResponseMessages.ValidationError,
                ex.Errors.Select(e => e.ErrorMessage).Distinct().ToList()),

            // ── Fallback ───────────────────────────────────────────────────────
            _ => (
                HttpStatusCode.InternalServerError,
                ErrorCodes.DatabaseError,
                _env.IsDevelopment() ? exception.Message : ResponseMessages.InternalError,
                _env.IsDevelopment() ? new List<string> { exception.StackTrace ?? "" } : null)
        };

        context.Response.StatusCode = (int)statusCode;

        ApiResponse response = errors is { Count: > 0 }
            ? ApiResponse.FailureResult(message, errors)
            : ApiResponse.FailureResult(message);

        // Đính kèm errorCode vào response (nếu ApiResponse hỗ trợ)
        var payload = new
        {
            success = false,
            errorCode,
            message,
            errors
        };

        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        await context.Response.WriteAsync(JsonSerializer.Serialize(payload, options));
    }
}
