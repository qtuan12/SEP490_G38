using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Common.Models;

public class PagedList<T>
{
    public List<T> Items { get; set; } = new();
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }

    public bool HasPreviousPage => PageNumber > 1;
    public bool HasNextPage => PageNumber < TotalPages;

    public PagedList() { }

    public PagedList(List<T> items, int count, int pageNumber, int pageSize)
    {
        Items = items;
        TotalCount = count;
        PageNumber = pageNumber;
        PageSize = pageSize;
        TotalPages = (int)Math.Ceiling(count / (double)pageSize);
    }
}

public static class PagedListExtensions
{
    /// <summary>
    /// Async version (khuyến khích dùng). Tránh block thread.
    /// </summary>
    public static async Task<PagedList<T>> ToPagedListAsync<T>(
        this IQueryable<T> source,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        pageNumber = pageNumber < 1 ? 1 : pageNumber;
        pageSize = pageSize < 1 ? 20 : pageSize > 100 ? 100 : pageSize;

        var count = await source.CountAsync(cancellationToken);
        var items = await source
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedList<T>(items, count, pageNumber, pageSize);
    }

    /// <summary>
    /// Overload nhận PaginationRequest trực tiếp.
    /// </summary>
    public static Task<PagedList<T>> ToPagedListAsync<T>(
        this IQueryable<T> source,
        PaginationRequest request,
        CancellationToken cancellationToken = default)
        => source.ToPagedListAsync(request.PageNumber, request.PageSize, cancellationToken);

    /// <summary>
    /// Sync version – chỉ dùng khi không có async context (hiếm gặp).
    /// </summary>
    public static PagedList<T> ToPagedList<T>(this IQueryable<T> source, int pageNumber, int pageSize)
    {
        pageNumber = pageNumber < 1 ? 1 : pageNumber;
        pageSize = pageSize < 1 ? 20 : pageSize;

        var count = source.Count();
        var items = source.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
        return new PagedList<T>(items, count, pageNumber, pageSize);
    }
}
