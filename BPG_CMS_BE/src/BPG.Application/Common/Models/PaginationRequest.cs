namespace BPG.Application.Common.Models;

/// <summary>
/// Base DTO cho mọi query có phân trang. Kế thừa class này cho các filter request cụ thể.
/// </summary>
public class PaginationRequest
{
    private int _pageNumber = 1;
    private int _pageSize = 20;

    public int PageNumber
    {
        get => _pageNumber;
        set => _pageNumber = value < 1 ? 1 : value;
    }

    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value < 1 ? 1 : value > 100 ? 100 : value; // max 100 records/page
    }

    public string? SortBy { get; set; }
    public bool SortDescending { get; set; } = false;
    public string? Search { get; set; }
}
