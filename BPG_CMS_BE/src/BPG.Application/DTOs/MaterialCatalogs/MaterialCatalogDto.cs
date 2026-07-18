namespace BPG.Application.DTOs.MaterialCatalogs;

public class MaterialCatalogDto
{
    public long MaterialId { get; set; }
    public long CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public int BaseUnitId { get; set; }
    public string BaseUnitName { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Specification { get; set; }
}
