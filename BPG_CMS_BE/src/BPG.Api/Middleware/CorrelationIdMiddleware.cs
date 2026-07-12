using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;
using Serilog.Context;
using System;
using System.Threading.Tasks;

namespace BPG.Api.Middleware
{
    public class CorrelationIdMiddleware
    {
        private readonly RequestDelegate _next;
        private const string CorrelationIdHeaderKey = "X-Correlation-ID";

        public CorrelationIdMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // 1. Kiểm tra xem Client có gửi sẵn CorrelationId trong Header không
            if (!context.Request.Headers.TryGetValue(CorrelationIdHeaderKey, out StringValues correlationId))
            {
                // Nếu chưa có, sinh mới một mã Guid ngẫu nhiên làm mã theo vết
                correlationId = Guid.NewGuid().ToString();
            }

            // 2. Tự động trả lại mã CorrelationId cho Response Header 
            context.Response.OnStarting(() =>
            {
                if (!context.Response.Headers.ContainsKey(CorrelationIdHeaderKey))
                {
                    context.Response.Headers.Append(CorrelationIdHeaderKey, correlationId);
                }
                return Task.CompletedTask;
            });

            // 3. Đẩy CorrelationId vào LogContext của Serilog bằng khối "using"
            using (LogContext.PushProperty("CorrelationId", correlationId.ToString()))
            {
                await _next(context);
            }
        }
    }
}
