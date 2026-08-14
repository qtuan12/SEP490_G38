using System.Data;

namespace BPG.Application.IRepositories;

/// <summary>
/// Unit of Work – entry point duy nhất để truy cập repository và commit transaction.
/// Inject IUnitOfWork vào service, KHÔNG inject IGenericRepository trực tiếp.
/// </summary>
public interface IUnitOfWork : IDisposable
{
    /// <summary>Lấy repository cho entity T.</summary>
    IGenericRepository<T> Repository<T>() where T : class;

    /// <summary>Lưu tất cả thay đổi vào DB trong 1 transaction.</summary>
    Task<int> SaveChangesAsync(CancellationToken ct = default);

    /// <summary>Thực thi raw SQL trực tiếp, bypass hoàn toàn change tracker.</summary>
    Task ExecuteSqlAsync(FormattableString sql, CancellationToken ct = default);

    /// <summary>Bắt đầu explicit transaction (dùng khi cần multi-step atomic operation).</summary>
    Task BeginTransactionAsync(CancellationToken ct = default);

    /// <summary>Bắt đầu transaction với isolation level cụ thể cho nghiệp vụ có tranh chấp đồng thời.</summary>
    Task BeginTransactionAsync(IsolationLevel isolationLevel, CancellationToken ct = default);

    /// <summary>Commit explicit transaction.</summary>
    Task CommitTransactionAsync(CancellationToken ct = default);

    /// <summary>Rollback explicit transaction khi có lỗi.</summary>
    Task RollbackTransactionAsync(CancellationToken ct = default);
}
