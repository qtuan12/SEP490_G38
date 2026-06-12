using System.Linq.Expressions;

namespace BPG.Application.IRepositories;

/// <summary>
/// Generic repository interface cho tất cả các entity.
/// Inject qua IUnitOfWork.Repository&lt;T&gt;() thay vì inject trực tiếp.
/// </summary>
public interface IGenericRepository<T> where T : class
{
    // ==================== QUERY ====================
    Task<T?> GetByIdAsync(long id, CancellationToken ct = default);

    Task<T?> FirstOrDefaultAsync(
        Expression<Func<T, bool>> predicate,
        CancellationToken ct = default);

    Task<List<T>> GetAllAsync(CancellationToken ct = default);

    Task<List<T>> FindAsync(
        Expression<Func<T, bool>> predicate,
        CancellationToken ct = default);

    Task<bool> AnyAsync(
        Expression<Func<T, bool>> predicate,
        CancellationToken ct = default);

    Task<int> CountAsync(
        Expression<Func<T, bool>>? predicate = null,
        CancellationToken ct = default);

    /// <summary>Trả về IQueryable để caller tự compose (filter, sort, include...).</summary>
    IQueryable<T> Query();

    // ==================== COMMAND ====================
    Task AddAsync(T entity, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<T> entities, CancellationToken ct = default);
    void Update(T entity);
    void UpdateRange(IEnumerable<T> entities);
    void Remove(T entity);
    void RemoveRange(IEnumerable<T> entities);
}
