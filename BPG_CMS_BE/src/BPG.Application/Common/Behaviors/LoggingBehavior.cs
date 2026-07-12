using MediatR;
using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Common.Behaviors
{
    public class LoggingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
        where TRequest : notnull
    {
        private readonly ILogger<LoggingBehavior<TRequest, TResponse>> _logger;

        public LoggingBehavior(ILogger<LoggingBehavior<TRequest, TResponse>> logger)
        {
            _logger = logger;
        }

        public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
        {
            var requestName = typeof(TRequest).Name;
            _logger.LogInformation("Bắt đầu xử lý Request: {RequestName} | Payload: {@Request}", requestName, request);

            var stopwatch = Stopwatch.StartNew();
            try
            {
                var response = await next();
                stopwatch.Stop();
                _logger.LogInformation("Xử lý thành công Request: {RequestName} | Hoàn tất sau {ElapsedMs}ms", requestName, stopwatch.ElapsedMilliseconds);
                return response;
            }
            catch (System.Exception ex)
            {
                stopwatch.Stop();
                _logger.LogError(ex, "Thao tác thất bại khi xử lý Request: {RequestName} | Thời gian: {ElapsedMs}ms", requestName, stopwatch.ElapsedMilliseconds);
                throw;
            }
        }
    }
}
