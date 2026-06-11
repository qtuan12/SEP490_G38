using BPG.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace BPG.Infrastructure.Data;

public class AuditInterceptor : SaveChangesInterceptor
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AuditInterceptor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        var context = eventData.Context;
        if (context == null)
            return base.SavingChangesAsync(eventData, result, cancellationToken);

        var userId = GetCurrentUserId();
        var now = DateTime.UtcNow;

        foreach (var entry in context.ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
                entry.Entity.CreatedBy = userId;
                entry.Entity.UpdatedAt = now;
                entry.Entity.UpdatedBy = userId;
                entry.Entity.IsDeleted = false;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
                entry.Entity.UpdatedBy = userId;
            }
        }

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private long? GetCurrentUserId()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        if (user == null) return null;

        var idClaim =
            user.FindFirst("sub")?.Value ??
            user.FindFirst("userId")?.Value ??
            user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

        return long.TryParse(idClaim, out var id) ? id : null;
    }
}
