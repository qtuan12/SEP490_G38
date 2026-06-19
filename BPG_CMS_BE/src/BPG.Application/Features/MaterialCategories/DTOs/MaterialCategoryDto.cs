using BPG.Application.Common.Models;

namespace BPG.Application.Features.MaterialCategories.DTOs;

public class MaterialCategoryDto
{
    public long CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string? Description { get; set; }
}
