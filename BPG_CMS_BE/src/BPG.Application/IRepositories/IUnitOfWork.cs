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

    /// <summary>Bắt đầu explicit transaction (dùng khi cần multi-step atomic operation).</summary>
    Task BeginTransactionAsync(CancellationToken ct = default);

    /// <summary>Commit explicit transaction.</summary>
    Task CommitTransactionAsync(CancellationToken ct = default);

    /// <summary>Rollback explicit transaction khi có lỗi.</summary>
    Task RollbackTransactionAsync(CancellationToken ct = default);
}
