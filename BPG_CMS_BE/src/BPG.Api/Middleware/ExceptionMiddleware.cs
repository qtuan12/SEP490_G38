using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using BPG.Application.Common.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BPG.Api.Middleware
{
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
                _logger.LogError(ex, "Unhandled exception occurred: {Message}", ex.Message);
                await HandleExceptionAsync(context, ex);
            }
        }

        private async Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            context.Response.ContentType = "application/json";

            var statusCode = exception switch
            {
                FluentValidation.ValidationException => HttpStatusCode.BadRequest,
                InvalidOperationException => HttpStatusCode.BadRequest,
                KeyNotFoundException => HttpStatusCode.NotFound,
                UnauthorizedAccessException => HttpStatusCode.Unauthorized,
                _ => HttpStatusCode.InternalServerError
            };

            context.Response.StatusCode = (int)statusCode;

            ApiResponse response;

            if (exception is FluentValidation.ValidationException validationException)
            {
                var errors = validationException.Errors.Select(e => e.ErrorMessage).ToList();
                response = ApiResponse.FailureResult("Dữ liệu không hợp lệ.", errors);
            }
            else if (statusCode == HttpStatusCode.InternalServerError)
            {
                var message = _env.IsDevelopment() ? exception.Message : "Đã xảy ra lỗi hệ thống. Vui lòng liên hệ ban quản trị.";
                var errors = _env.IsDevelopment() ? new List<string> { exception.StackTrace ?? "" } : null;
                response = ApiResponse.FailureResult(message, errors);
            }
            else
            {
                response = ApiResponse.FailureResult(exception.Message);
            }

            var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
            var json = JsonSerializer.Serialize(response, options);

            await context.Response.WriteAsync(json);
        }
    }
}
