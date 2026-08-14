using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Infrastructure.Data;
using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage;

namespace BPG.Infrastructure.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;
    private readonly IRealtimeNotificationSender? _realtimeSender;
    private readonly Dictionary<Type, object> _repositories = new();
    private readonly HashSet<string> _pendingChangedEntities = [];
    private IDbContextTransaction? _transaction;

    private static readonly HashSet<Type> RealtimeIgnoredEntityTypes =
    [
        typeof(Notification),
        typeof(OtpToken),
        typeof(RefreshToken)
    ];

    private static readonly HashSet<string> UserAuthenticationProperties =
    [
        nameof(User.FailedLoginCount),
        nameof(User.LastLoginAt),
        nameof(User.LockedUntil),
        nameof(User.PasswordChangedAt),
        nameof(User.PasswordHash)
    ];

    public UnitOfWork(AppDbContext context, IRealtimeNotificationSender? realtimeSender = null)
    {
        _context = context;
        _realtimeSender = realtimeSender;
    }

    public IGenericRepository<T> Repository<T>() where T : class
    {
        var type = typeof(T);
        if (!_repositories.ContainsKey(type))
            _repositories[type] = new GenericRepository<T>(_context);

        return (IGenericRepository<T>)_repositories[type];
    }

    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var changedEntities = _context.ChangeTracker.Entries()
            .Where(entry => entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Where(IsRealtimeRelevant)
            .Select(entry => entry.Metadata.ClrType.Name)
            .Distinct()
            .OrderBy(name => name)
            .ToArray();

        var affectedRows = await _context.SaveChangesAsync(ct);

        if (affectedRows > 0 && changedEntities.Length > 0)
        {
            if (_transaction is not null)
            {
                _pendingChangedEntities.UnionWith(changedEntities);
            }
            else
            {
                await PublishDataChangedAsync(changedEntities, CancellationToken.None);
            }
        }

        return affectedRows;
    }

    public async Task ExecuteSqlAsync(FormattableString sql, CancellationToken ct = default)
        => await _context.Database.ExecuteSqlAsync(sql, ct);

    public async Task BeginTransactionAsync(CancellationToken ct = default)
    {
        _pendingChangedEntities.Clear();
        _transaction = await _context.Database.BeginTransactionAsync(ct);
    }

    public async Task BeginTransactionAsync(IsolationLevel isolationLevel, CancellationToken ct = default)
    {
        _pendingChangedEntities.Clear();
        _transaction = await _context.Database.BeginTransactionAsync(isolationLevel, ct);
    }

    public async Task CommitTransactionAsync(CancellationToken ct = default)
    {
        if (_transaction == null)
            throw new InvalidOperationException("Chưa bắt đầu transaction.");
        await _transaction.CommitAsync(ct);
        await _transaction.DisposeAsync();
        _transaction = null;

        var changedEntities = _pendingChangedEntities.OrderBy(name => name).ToArray();
        _pendingChangedEntities.Clear();
        // Commit đã thành công nên vẫn phải báo cho client khác dù request gốc vừa bị hủy.
        await PublishDataChangedAsync(changedEntities, CancellationToken.None);
    }

    public async Task RollbackTransactionAsync(CancellationToken ct = default)
    {
        if (_transaction == null) return;
        try
        {
            await _transaction.RollbackAsync(ct);
        }
        finally
        {
            await _transaction.DisposeAsync();
            _transaction = null;
            _pendingChangedEntities.Clear();
        }
    }

    private static bool IsRealtimeRelevant(EntityEntry entry)
    {
        if (RealtimeIgnoredEntityTypes.Contains(entry.Metadata.ClrType)) return false;

        if (entry.Entity is User && entry.State == EntityState.Modified)
        {
            return entry.Properties.Any(property =>
                property.IsModified
                && !UserAuthenticationProperties.Contains(property.Metadata.Name)
                && !Equals(property.OriginalValue, property.CurrentValue));
        }

        return true;
    }

    private async Task PublishDataChangedAsync(IReadOnlyCollection<string> changedEntities, CancellationToken ct)
    {
        if (changedEntities.Count == 0 || _realtimeSender is null) return;

        // Realtime không được làm hỏng giao dịch nghiệp vụ đã lưu thành công.
        try
        {
            await _realtimeSender.SendToAllAsync(
                HubMethodNames.DataChanged,
                new { Entities = changedEntities, ChangedAt = DateTimeOffset.UtcNow },
                ct);
        }
        catch
        {
            // Client sẽ đồng bộ lại sau khi SignalR reconnect.
        }
    }

    public void Dispose()
    {
        _transaction?.Dispose();
        _pendingChangedEntities.Clear();
        _context.Dispose();
    }
}
