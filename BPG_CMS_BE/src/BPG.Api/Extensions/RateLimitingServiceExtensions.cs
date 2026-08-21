using System.Security.Claims;
using System.Threading.RateLimiting;
using BPG.Api.Configuration;
using BPG.Application.Common.Models;
using Microsoft.AspNetCore.RateLimiting;

namespace BPG.Api.Extensions;

public static class RateLimitingServiceExtensions
{
    public static IServiceCollection AddConfiguredRateLimiting(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var settings = configuration.GetSection("RateLimiting").Get<RateLimitOptions>() ?? new RateLimitOptions();

        services.Configure<RateLimitOptions>(configuration.GetSection("RateLimiting"));
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, cancellationToken) =>
            {
                context.HttpContext.Response.ContentType = "application/json";

                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        Math.Ceiling(retryAfter.TotalSeconds).ToString("0");
                }

                var responsePayload = ApiResponse<string>.FailureResult(
                    errorCode: "RATE_LIMIT_EXCEEDED",
                    message: settings.RejectionMessage,
                    errors: new List<string> { settings.RejectionMessage });

                await context.HttpContext.Response.WriteAsJsonAsync(responsePayload, cancellationToken);
            };

            AddFixedWindowPolicy(options, RateLimitPolicies.Auth, settings.GetPolicy(RateLimitPolicies.Auth));
            AddFixedWindowPolicy(options, RateLimitPolicies.Query, settings.GetPolicy(RateLimitPolicies.Query));
            AddFixedWindowPolicy(options, RateLimitPolicies.QueryDetail, settings.GetPolicy(RateLimitPolicies.QueryDetail));
            AddFixedWindowPolicy(options, RateLimitPolicies.Mutation, settings.GetPolicy(RateLimitPolicies.Mutation));
            AddFixedWindowPolicy(options, RateLimitPolicies.Upload, settings.GetPolicy(RateLimitPolicies.Upload));
            AddFixedWindowPolicy(options, RateLimitPolicies.Report, settings.GetPolicy(RateLimitPolicies.Report));
        });

        return services;
    }

    private static void AddFixedWindowPolicy(
        RateLimiterOptions options,
        string policyName,
        RateLimitPolicyOptions policy)
    {
        options.AddPolicy(policyName, httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: GetPartitionKey(httpContext, policyName),
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = Math.Max(1, policy.PermitLimit),
                    Window = TimeSpan.FromSeconds(Math.Max(1, policy.WindowSeconds)),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = Math.Max(0, policy.QueueLimit),
                    AutoReplenishment = true
                }));
    }

    private static string GetPartitionKey(HttpContext context, string policyName)
    {
        var scope = policyName == RateLimitPolicies.Auth
            ? $"{policyName}:{GetRouteScope(context)}"
            : policyName;

        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrWhiteSpace(userId))
        {
            return $"{scope}:user:{userId}";
        }

        var ipAddress = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return $"{scope}:ip:{ipAddress}";
    }

        private static string GetRouteScope(HttpContext context) =>
        (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText?.ToLowerInvariant()
        ?? context.Request.Path.Value?.ToLowerInvariant()
        ?? "unknown";
}
