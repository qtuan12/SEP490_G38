namespace BPG.Application.Features.MaterialCategories.DTOs;

public class UpdateMaterialCategoryRequest
{
    public string CategoryName { get; set; } = string.Empty;
    public string? Description { get; set; }
}
