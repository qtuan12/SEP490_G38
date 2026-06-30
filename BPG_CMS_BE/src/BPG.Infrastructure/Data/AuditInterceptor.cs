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

    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        Apply(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Apply(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void Apply(DbContext? context)
    {
        if (context == null) return;

        var userId = GetCurrentUserId();
        var now = DateTime.UtcNow;

        foreach (var entry in context.ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.CreatedAt == default)
                    entry.Entity.CreatedAt = now;

                if (entry.Entity.CreatedBy == null)
                    entry.Entity.CreatedBy = userId;

                if (entry.Entity.UpdatedAt == null || entry.Entity.UpdatedAt == default)
                    entry.Entity.UpdatedAt = now;

                if (entry.Entity.UpdatedBy == null)
                    entry.Entity.UpdatedBy = userId;

                entry.Entity.IsDeleted = false;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
                if (userId.HasValue)
                {
                    entry.Entity.UpdatedBy = userId;
                }
            }
        }
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
