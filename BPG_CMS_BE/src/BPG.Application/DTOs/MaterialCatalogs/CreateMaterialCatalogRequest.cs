namespace BPG.Application.DTOs.MaterialCatalogs;

public class CreateMaterialCatalogRequest
{
    public long CategoryId { get; set; }
    public int BaseUnitId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Specification { get; set; }
}
