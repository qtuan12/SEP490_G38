using BPG.Application.Common.Models;

namespace BPG.Application.DTOs.MaterialCategories;

public class MaterialCategoryDto
{
    public long CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string? Description { get; set; }
}
