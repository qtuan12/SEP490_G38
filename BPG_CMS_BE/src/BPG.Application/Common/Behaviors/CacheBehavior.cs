using System.Reflection;
using System.Text.Json;
using BPG.Application.Common.Attributes;
using MediatR;
using Microsoft.Extensions.Caching.Memory;

namespace BPG.Application.Common.Behaviors;

public sealed class CacheBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = false
    };

    private readonly IMemoryCache _cache;

    public CacheBehavior(IMemoryCache cache)
    {
        _cache = cache;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var cacheAttribute = typeof(TRequest).GetCustomAttribute<CacheableAttribute>();
        if (cacheAttribute is null)
        {
            return await next();
        }

        var cacheKey = $"{typeof(TRequest).FullName}:{JsonSerializer.Serialize(request, JsonOptions)}";
        if (_cache.TryGetValue(cacheKey, out TResponse? cachedResponse))
        {
            return cachedResponse!;
        }

        var response = await next();
        _cache.Set(cacheKey, response, TimeSpan.FromSeconds(cacheAttribute.DurationSeconds));
        return response;
    }
}
