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
    private readonly HashSet<long> _pendingAffectedProjectIds = [];
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

        if (changedEntities.Length > 0)
        {
            await ExtractAffectedProjectIdsAsync(ct);
        }

        var affectedRows = await _context.SaveChangesAsync(ct);

        if (affectedRows > 0 && changedEntities.Length > 0)
        {
            if (_transaction is not null)
            {
                _pendingChangedEntities.UnionWith(changedEntities);
            }
            else
            {
                var affectedProjectIds = _pendingAffectedProjectIds.ToArray();
                _pendingAffectedProjectIds.Clear();
                await PublishDataChangedAsync(changedEntities, affectedProjectIds, CancellationToken.None);
            }
        }

        return affectedRows;
    }

    public async Task ExecuteSqlAsync(FormattableString sql, CancellationToken ct = default)
        => await _context.Database.ExecuteSqlAsync(sql, ct);

    public async Task BeginTransactionAsync(CancellationToken ct = default)
    {
        _pendingChangedEntities.Clear();
        _pendingAffectedProjectIds.Clear();
        _transaction = await _context.Database.BeginTransactionAsync(ct);
    }

    public async Task BeginTransactionAsync(IsolationLevel isolationLevel, CancellationToken ct = default)
    {
        _pendingChangedEntities.Clear();
        _pendingAffectedProjectIds.Clear();
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
        var affectedProjectIds = _pendingAffectedProjectIds.ToArray();
        _pendingChangedEntities.Clear();
        _pendingAffectedProjectIds.Clear();
        // Commit đã thành công nên vẫn phải báo cho client khác dù request gốc vừa bị hủy.
        await PublishDataChangedAsync(changedEntities, affectedProjectIds, CancellationToken.None);
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
            _pendingAffectedProjectIds.Clear();
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

    private async Task ExtractAffectedProjectIdsAsync(CancellationToken ct)
    {
        var phaseIdsToLookup = new HashSet<long>();
        var poIdsToLookup = new HashSet<long>();
        var requestIdsToLookup = new HashSet<long>();
        var receiptIdsToLookup = new HashSet<long>();
        
        var entries = _context.ChangeTracker.Entries()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .ToList();

        foreach (var entry in entries)
        {
            if (entry.Metadata.FindProperty("ProjectId") != null)
            {
                if (entry.CurrentValues["ProjectId"] is long pid && pid > 0)
                    _pendingAffectedProjectIds.Add(pid);
            }
            else if (entry.Metadata.FindProperty("PhaseId") != null)
            {
                if (entry.CurrentValues["PhaseId"] is long phaseId && phaseId > 0)
                    phaseIdsToLookup.Add(phaseId);
            }
            else if (entry.Metadata.FindProperty("POId") != null)
            {
                if (entry.CurrentValues["POId"] is long poId && poId > 0)
                    poIdsToLookup.Add(poId);
            }
            else if (entry.Metadata.FindProperty("RequestId") != null)
            {
                if (entry.CurrentValues["RequestId"] is long reqId && reqId > 0)
                    requestIdsToLookup.Add(reqId);
            }
            else if (entry.Metadata.FindProperty("ReceiptId") != null)
            {
                if (entry.CurrentValues["ReceiptId"] is long receiptId && receiptId > 0)
                    receiptIdsToLookup.Add(receiptId);
            }
        }

        if (phaseIdsToLookup.Count > 0)
        {
            var pids = await _context.Set<Phase>().Where(p => phaseIdsToLookup.Contains(p.PhaseId)).Select(p => p.ProjectId).ToListAsync(ct);
            foreach (var p in pids) _pendingAffectedProjectIds.Add(p);
        }
        if (poIdsToLookup.Count > 0)
        {
            var pids = await _context.Set<PurchaseOrder>().Where(p => poIdsToLookup.Contains(p.POId)).Select(p => p.ProjectId).ToListAsync(ct);
            foreach (var p in pids) _pendingAffectedProjectIds.Add(p);
        }
        if (requestIdsToLookup.Count > 0)
        {
            var pids = await _context.Set<MaterialRequest>().Include(m => m.Phase).Where(m => requestIdsToLookup.Contains(m.RequestId)).Select(m => m.Phase.ProjectId).ToListAsync(ct);
            foreach (var p in pids) _pendingAffectedProjectIds.Add(p);
        }
        if (receiptIdsToLookup.Count > 0)
        {
            var pids = await _context.Set<GoodsReceipt>().Include(r => r.PurchaseOrder).Where(r => receiptIdsToLookup.Contains(r.ReceiptId)).Select(r => r.PurchaseOrder.ProjectId).ToListAsync(ct);
            foreach (var p in pids) _pendingAffectedProjectIds.Add(p);
        }
    }

    private async Task PublishDataChangedAsync(IReadOnlyCollection<string> changedEntities, IReadOnlyCollection<long> affectedProjectIds, CancellationToken ct)
    {
        if (changedEntities.Count == 0 || _realtimeSender is null) return;

        try
        {
            var payload = new { Entities = changedEntities, ChangedAt = DateTimeOffset.UtcNow };
            if (affectedProjectIds.Count > 0)
            {
                foreach (var projectId in affectedProjectIds)
                {
                    await _realtimeSender.SendToGroupAsync($"Project_{projectId}", HubMethodNames.DataChanged, payload, ct);
                }
            }
            else
            {
                // Nếu không thuộc Project nào (ví dụ Material, User...), gửi cho Global (Project_0)
                await _realtimeSender.SendToGroupAsync("Project_0", HubMethodNames.DataChanged, payload, ct);
            }
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
